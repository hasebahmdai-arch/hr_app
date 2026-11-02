import { eachDayOfInterval, format } from "date-fns";
import { Employee, LeaveRequest } from "@/lib/models";

export const LEAVE_TYPES = ["Sick", "Casual"] as const;
export type LeaveBalanceType = (typeof LEAVE_TYPES)[number];

export const LEAVE_DEFAULTS: Record<LeaveBalanceType, number> = {
  Sick: 8,
  Casual: 10,
};

export type LeaveBalanceRow = {
  leaveType: LeaveBalanceType;
  year: number;
  entitled: number;
  used: number;
};

export function isLeaveBalanceType(value: string): value is LeaveBalanceType {
  return LEAVE_TYPES.includes(value as LeaveBalanceType);
}

export function countLeaveDays(start: Date, end: Date) {
  return eachDayOfInterval({ start, end }).length;
}

export function leaveYearFromDate(date: Date | string) {
  if (typeof date === "string") return Number(date.slice(0, 4));
  return date.getFullYear();
}

export function summarizeBalances(balances: LeaveBalanceRow[] | undefined, year: number) {
  return LEAVE_TYPES.map((leaveType) => {
    const row = balances?.find((b) => b.leaveType === leaveType && b.year === year);
    const entitled = row?.entitled ?? LEAVE_DEFAULTS[leaveType];
    const used = row?.used ?? 0;
    return {
      leaveType,
      year,
      entitled,
      used,
      remaining: Math.max(entitled - used, 0),
    };
  });
}

function balanceKey(leaveType: string, year: number) {
  return `${leaveType}:${year}`;
}

/** Create current-year rows from previous year (half remaining + defaults). Idempotent. */
export function rolloverBalancesToYear(
  balances: LeaveBalanceRow[],
  newYear: number
): LeaveBalanceRow[] {
  const next = [...balances];
  const existing = new Set(next.map((b) => balanceKey(b.leaveType, b.year)));

  for (const leaveType of LEAVE_TYPES) {
    if (existing.has(balanceKey(leaveType, newYear))) continue;
    const prev = next.find((b) => b.leaveType === leaveType && b.year === newYear - 1);
    const remaining = prev ? Math.max((prev.entitled ?? 0) - (prev.used ?? 0), 0) : 0;
    const carry = Math.floor(remaining / 2);
    next.push({
      leaveType,
      year: newYear,
      entitled: LEAVE_DEFAULTS[leaveType] + carry,
      used: 0,
    });
  }
  return next;
}

export function ensureYearBalancesOnDoc(
  balances: LeaveBalanceRow[] | undefined,
  year: number
): LeaveBalanceRow[] {
  let next = [...(balances ?? [])];
  const hasYear = LEAVE_TYPES.every((t) =>
    next.some((b) => b.leaveType === t && b.year === year)
  );
  if (!hasYear) {
    next = rolloverBalancesToYear(next, year);
  }
  for (const leaveType of LEAVE_TYPES) {
    if (!next.some((b) => b.leaveType === leaveType && b.year === year)) {
      next.push({
        leaveType,
        year,
        entitled: LEAVE_DEFAULTS[leaveType],
        used: 0,
      });
    }
  }
  return next;
}

export async function ensureYearBalances(employeeId: string, year = new Date().getFullYear()) {
  const employee = await Employee.findById(employeeId).select("leaveBalances");
  if (!employee) throw new Error("Employee not found");

  const before = JSON.stringify(employee.leaveBalances ?? []);
  const next = ensureYearBalancesOnDoc(
    (employee.leaveBalances ?? []) as LeaveBalanceRow[],
    year
  );
  if (JSON.stringify(next) !== before) {
    employee.leaveBalances = next as never;
    await employee.save();
  }
  return next;
}

export function getRemaining(balances: LeaveBalanceRow[], leaveType: LeaveBalanceType, year: number) {
  const row = balances.find((b) => b.leaveType === leaveType && b.year === year);
  if (!row) return LEAVE_DEFAULTS[leaveType];
  return Math.max(row.entitled - row.used, 0);
}

/** Remaining after subtracting reserved (approved but not yet deducted) days. */
export async function getAvailableRemaining(
  employeeId: string,
  leaveType: LeaveBalanceType,
  year: number,
  excludeRequestId?: string
) {
  const balances = await ensureYearBalances(employeeId, year);
  const remaining = getRemaining(balances, leaveType, year);

  const filter: Record<string, unknown> = {
    employeeId,
    leaveType,
    status: "COMPLETED",
    $expr: { $lt: ["$daysDeductedSoFar", "$daysRequested"] },
  };
  if (excludeRequestId) filter._id = { $ne: excludeRequestId };

  const open = await LeaveRequest.find(filter)
    .select("daysRequested daysDeductedSoFar startDate endDate")
    .lean();

  let reserved = 0;
  for (const req of open) {
    const startYear = leaveYearFromDate(new Date(req.startDate as Date));
    if (startYear !== year) continue;
    const requested = Number(req.daysRequested ?? 0);
    const deducted = Number(req.daysDeductedSoFar ?? 0);
    reserved += Math.max(requested - deducted, 0);
  }

  return Math.max(remaining - reserved, 0);
}

export async function assertCanTake(
  employeeId: string,
  leaveType: string,
  start: Date,
  end: Date,
  excludeRequestId?: string
) {
  if (!isLeaveBalanceType(leaveType)) {
    throw new Error("Leave type must be Sick or Casual");
  }
  const days = countLeaveDays(start, end);
  const year = leaveYearFromDate(start);
  const available = await getAvailableRemaining(employeeId, leaveType, year, excludeRequestId);
  if (days > available) {
    throw new Error(`Insufficient ${leaveType} leave remaining (${available} left, ${days} requested)`);
  }
  return { days, year, leaveType };
}

export async function deductOneDay(employeeId: string, leaveType: LeaveBalanceType, year: number) {
  const balances = await ensureYearBalances(employeeId, year);
  const idx = balances.findIndex((b) => b.leaveType === leaveType && b.year === year);
  if (idx < 0) throw new Error("Leave balance missing");
  balances[idx] = { ...balances[idx], used: (balances[idx].used ?? 0) + 1 };
  await Employee.updateOne({ _id: employeeId }, { $set: { leaveBalances: balances } });
  return balances[idx];
}

export async function creditDays(
  employeeId: string,
  leaveType: LeaveBalanceType,
  year: number,
  days: number
) {
  if (days <= 0) return;
  const balances = await ensureYearBalances(employeeId, year);
  const idx = balances.findIndex((b) => b.leaveType === leaveType && b.year === year);
  if (idx < 0) return;
  balances[idx] = {
    ...balances[idx],
    used: Math.max((balances[idx].used ?? 0) - days, 0),
  };
  await Employee.updateOne({ _id: employeeId }, { $set: { leaveBalances: balances } });
}

export function datesInLeaveRange(start: Date, end: Date, throughDateStr: string) {
  return eachDayOfInterval({ start, end })
    .map((d) => format(d, "yyyy-MM-dd"))
    .filter((d) => d <= throughDateStr);
}

export function defaultLeaveBalancesForCreate(
  sickEntitled = LEAVE_DEFAULTS.Sick,
  casualEntitled = LEAVE_DEFAULTS.Casual,
  year = new Date().getFullYear()
): LeaveBalanceRow[] {
  return [
    { leaveType: "Sick", year, entitled: sickEntitled, used: 0 },
    { leaveType: "Casual", year, entitled: casualEntitled, used: 0 },
  ];
}

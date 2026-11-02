import { format } from "date-fns";
import connectDB from "@/lib/db";
import {
  creditDays,
  datesInLeaveRange,
  deductOneDay,
  isLeaveBalanceType,
  leaveYearFromDate,
  type LeaveBalanceType,
} from "@/lib/leave-balance";
import { Employee, LeaveRequest, Timesheet } from "@/lib/models";
import { todayInCompanyTz } from "@/lib/timesheet-auto-checkout";

const BATCH_LIMIT = 200;

type LeaveDoc = {
  _id: { toString(): string };
  employeeId: { toString(): string };
  leaveType: string;
  startDate: Date;
  endDate: Date;
  daysRequested?: number;
  daysDeductedSoFar?: number;
  deductedDates?: string[];
  save(): Promise<unknown>;
};

async function markLeaveDay(employeeId: string, date: string) {
  const employee = await Employee.findById(employeeId).select("shiftId").lean();
  await Timesheet.findOneAndUpdate(
    { employeeId, date },
    {
      $set: {
        statusCode: "L",
        source: "manual",
        workedMinutes: 0,
        shortMinutes: 0,
        shiftId: employee?.shiftId,
      },
      $setOnInsert: {
        expectedMinutes: 480,
        breakMinutes: 0,
        breaks: [],
        sessions: [],
      },
      $unset: {
        checkIn: "",
        checkOut: "",
        checkinStatus: "",
        checkoutStatus: "",
      },
    },
    { upsert: true }
  );
}

async function processOneLeave(doc: LeaveDoc, today: string) {
  if (!isLeaveBalanceType(doc.leaveType)) return 0;
  const leaveType = doc.leaveType as LeaveBalanceType;
  const deducted = new Set(doc.deductedDates ?? []);
  const pending = datesInLeaveRange(new Date(doc.startDate), new Date(doc.endDate), today).filter(
    (d) => !deducted.has(d)
  );
  if (!pending.length) return 0;

  let applied = 0;
  for (const date of pending) {
    const year = leaveYearFromDate(date);
    await deductOneDay(doc.employeeId.toString(), leaveType, year);
    await markLeaveDay(doc.employeeId.toString(), date);
    deducted.add(date);
    applied += 1;
  }

  doc.deductedDates = Array.from(deducted).sort();
  doc.daysDeductedSoFar = doc.deductedDates.length;
  await doc.save();
  return applied;
}

/** Global cron: process incomplete approved leaves (capped). */
export async function processLeaveDeductionsGlobal(limit = BATCH_LIMIT) {
  await connectDB();
  const today = todayInCompanyTz();
  const endOfToday = new Date(`${today}T23:59:59.999`);

  const requests = await LeaveRequest.find({
    status: "COMPLETED",
    startDate: { $lte: endOfToday },
    $expr: { $lt: ["$daysDeductedSoFar", "$daysRequested"] },
  })
    .sort({ startDate: 1 })
    .limit(limit);

  let deductedDays = 0;
  for (const req of requests) {
    deductedDays += await processOneLeave(req as unknown as LeaveDoc, today);
  }
  return { deductedDays, processed: requests.length, today };
}

/** Scoped catch-up for one employee (punch/today paths). */
export async function processLeaveDeductionsForEmployee(employeeId: string) {
  await connectDB();
  const today = todayInCompanyTz();
  const endOfToday = new Date(`${today}T23:59:59.999`);

  const requests = await LeaveRequest.find({
    employeeId,
    status: "COMPLETED",
    startDate: { $lte: endOfToday },
    $expr: { $lt: ["$daysDeductedSoFar", "$daysRequested"] },
  }).limit(50);

  let deductedDays = 0;
  for (const req of requests) {
    deductedDays += await processOneLeave(req as unknown as LeaveDoc, today);
  }
  return { deductedDays, today };
}

/** Credit used days and clear L rows for deducted dates when leave is cancelled. */
export async function revertLeaveDeductions(request: {
  employeeId: { toString(): string };
  leaveType: string;
  startDate: Date;
  deductedDates?: string[];
  daysDeductedSoFar?: number;
}) {
  if (!isLeaveBalanceType(request.leaveType)) return;
  const employeeId = request.employeeId.toString();
  const dates = request.deductedDates ?? [];
  const byYear = new Map<number, number>();
  for (const date of dates) {
    const y = leaveYearFromDate(date);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  for (const [year, days] of Array.from(byYear.entries())) {
    await creditDays(employeeId, request.leaveType, year, days);
  }
  for (const date of dates) {
    await Timesheet.deleteOne({
      employeeId,
      date,
      statusCode: "L",
      checkIn: { $exists: false },
    });
    // If row had other data, just clear L — prefer delete only pure leave rows
    await Timesheet.updateOne(
      { employeeId, date, statusCode: "L" },
      { $set: { statusCode: "P" } }
    );
  }
}

export function leaveDaysRequestedLabel(start: Date, end: Date) {
  return `${format(start, "yyyy-MM-dd")} → ${format(end, "yyyy-MM-dd")}`;
}

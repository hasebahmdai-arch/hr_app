import { eachDayOfInterval, format } from "date-fns";
import type { RequestType } from "@/lib/constants";
import { Employee, Timesheet } from "@/lib/models";
import { shiftToMinutes } from "@/lib/profile-utils";
import { computeNetWorkedMinutes } from "@/lib/timesheet-session";

export interface TimesheetSnapshot {
  date: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created: boolean;
}

export interface EffectSnapshot {
  dates: TimesheetSnapshot[];
}

type ShiftInfo = {
  _id?: unknown;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
};

function serializeTimesheet(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!doc) return null;
  return {
    checkIn: doc.checkIn ? new Date(doc.checkIn as Date).toISOString() : undefined,
    checkOut: doc.checkOut ? new Date(doc.checkOut as Date).toISOString() : undefined,
    workedMinutes: doc.workedMinutes,
    shortMinutes: doc.shortMinutes,
    breakMinutes: doc.breakMinutes,
    statusCode: doc.statusCode,
    source: doc.source,
    checkinStatus: doc.checkinStatus,
    expectedMinutes: doc.expectedMinutes,
  };
}

async function getShiftForEmployee(employeeId: string): Promise<ShiftInfo | null> {
  const employee = await Employee.findById(employeeId).populate("shiftId");
  return (employee?.shiftId as ShiftInfo) ?? null;
}

function expectedMinutesForShift(shift: ShiftInfo | null) {
  if (shift?.startTime && shift?.endTime) {
    return shiftToMinutes(shift.startTime, shift.endTime, shift.breakMinutes ?? 60);
  }
  return 480;
}

async function findTimesheet(employeeId: string, date: string) {
  const doc = await Timesheet.findOne({ employeeId, date }).lean();
  return doc as Record<string, unknown> | null;
}

async function applyDateEffect(
  employeeId: string,
  date: string,
  patch: Record<string, unknown>,
  shift: ShiftInfo | null,
  unset: string[] = []
): Promise<TimesheetSnapshot> {
  const before = await findTimesheet(employeeId, date);
  const expectedMinutes = expectedMinutesForShift(shift);
  const setPatch = { ...patch };
  for (const key of unset) delete setPatch[key];

  if (before) {
    const update: Record<string, unknown> = { $set: { ...setPatch, expectedMinutes: before.expectedMinutes ?? expectedMinutes } };
    if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, ""]));
    const updated = await Timesheet.findOneAndUpdate({ employeeId, date }, update, { new: true }).lean();
    return {
      date,
      before: serializeTimesheet(before),
      after: serializeTimesheet(updated as Record<string, unknown>),
      created: false,
    };
  }

  const created = await Timesheet.create({
    employeeId,
    date,
    shiftId: shift?._id,
    expectedMinutes,
    workedMinutes: 0,
    shortMinutes: 0,
    breakMinutes: 0,
    breaks: [],
    statusCode: "P",
    ...setPatch,
  });
  const after = created.toObject() as Record<string, unknown>;
  return {
    date,
    before: null,
    after: serializeTimesheet(after),
    created: true,
  };
}

const ATTENDANCE_TYPES: RequestType[] = ["punch", "leave", "wfh", "official-duty", "relaxation", "travel"];

export function isAttendanceRequestType(type: RequestType) {
  return ATTENDANCE_TYPES.includes(type);
}

export async function applyRequestEffect(
  type: RequestType,
  request: Record<string, unknown>
): Promise<EffectSnapshot | null> {
  if (!isAttendanceRequestType(type)) return null;

  const employeeId = (request.employeeId as { toString(): string }).toString();
  const shift = await getShiftForEmployee(employeeId);
  const dates: TimesheetSnapshot[] = [];

  if (type === "punch") {
    const punchType = request.punchType as string;
    const requestedTimestamp = request.requestedTimestamp as Date;
    if (!requestedTimestamp) throw new Error("Punch request missing requested time");

    const date = format(new Date(requestedTimestamp), "yyyy-MM-dd");
    const existing = await findTimesheet(employeeId, date);
    const punchAt = new Date(requestedTimestamp);

    if (punchType === "check_in") {
      if (existing?.checkIn) throw new Error("Check-in already recorded for this date");
      dates.push(
        await applyDateEffect(employeeId, date, {
          checkIn: punchAt,
          source: "manual",
          statusCode: "P",
        }, shift)
      );
    } else if (punchType === "check_out") {
      if (!existing?.checkIn) throw new Error("Cannot check out without an existing check-in");
      if (existing?.checkOut) throw new Error("Check-out already recorded for this date");
      const checkIn = new Date(existing.checkIn as Date);
      if (punchAt.getTime() < checkIn.getTime()) {
        throw new Error("Check-out time must be on or after check-in");
      }
      const workedMinutes = computeNetWorkedMinutes(checkIn, punchAt);
      const expectedMinutes = Number(existing?.expectedMinutes ?? expectedMinutesForShift(shift));
      dates.push(
        await applyDateEffect(employeeId, date, {
          checkOut: punchAt,
          workedMinutes,
          breakMinutes: existing?.breakMinutes ?? 0,
          shortMinutes: Math.max(expectedMinutes - workedMinutes, 0),
          source: "manual",
          statusCode: "P",
        }, shift)
      );
    } else {
      throw new Error("Invalid punch type");
    }
  }

  if (type === "leave") {
    const start = new Date(request.startDate as Date);
    const end = new Date(request.endDate as Date);
    for (const day of eachDayOfInterval({ start, end })) {
      const date = format(day, "yyyy-MM-dd");
      dates.push(
        await applyDateEffect(employeeId, date, {
          statusCode: "L",
          source: "manual",
          workedMinutes: 0,
          shortMinutes: 0,
        }, shift, ["checkIn", "checkOut", "checkinStatus", "checkoutStatus"])
      );
    }
  }

  if (type === "wfh") {
    const dayDates = (request.dates as Date[]) ?? [];
    for (const day of dayDates) {
      const date = format(new Date(day), "yyyy-MM-dd");
      dates.push(
        await applyDateEffect(employeeId, date, {
          statusCode: "W",
          source: "manual",
        }, shift)
      );
    }
  }

  if (type === "official-duty") {
    const dayDates = (request.dates as Date[]) ?? [];
    for (const day of dayDates) {
      const date = format(new Date(day), "yyyy-MM-dd");
      dates.push(
        await applyDateEffect(employeeId, date, {
          statusCode: "O",
          source: "manual",
        }, shift)
      );
    }
  }

  if (type === "travel") {
    const dayDates = (request.dates as Date[]) ?? [];
    for (const day of dayDates) {
      const date = format(new Date(day), "yyyy-MM-dd");
      dates.push(
        await applyDateEffect(employeeId, date, {
          statusCode: "T",
          source: "manual",
        }, shift)
      );
    }
  }

  if (type === "relaxation") {
    const day = new Date(request.date as Date);
    const minutes = (request.minutes as number) ?? 0;
    const date = format(day, "yyyy-MM-dd");
    const existing = await findTimesheet(employeeId, date);
    if (!existing) throw new Error("No timesheet record found for relaxation date");

    const shortMinutes = Math.max(Number(existing.shortMinutes) - minutes, 0);
    const patch: Record<string, unknown> = {
      shortMinutes,
      source: "manual",
    };
    const unset: string[] = [];
    if (shortMinutes === 0 && existing.checkinStatus) {
      unset.push("checkinStatus");
    }
    dates.push(await applyDateEffect(employeeId, date, patch, shift, unset));
  }

  return { dates };
}

export async function revertRequestEffect(
  type: RequestType,
  request: Record<string, unknown>
): Promise<void> {
  if (!isAttendanceRequestType(type)) return;

  const snapshot = request.effectSnapshot as EffectSnapshot | undefined;
  if (!snapshot?.dates?.length) return;

  const employeeId = (request.employeeId as { toString(): string }).toString();

  for (const entry of snapshot.dates) {
    if (entry.created && !entry.before) {
      await Timesheet.deleteOne({ employeeId, date: entry.date });
      continue;
    }

    if (entry.before) {
      const restore: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry.before)) {
        if (value === undefined) continue;
        if (key === "checkIn" || key === "checkOut") {
          restore[key] = value ? new Date(value as string) : undefined;
        } else {
          restore[key] = value;
        }
      }
      await Timesheet.findOneAndUpdate({ employeeId, date: entry.date }, { $set: restore });
    }
  }
}

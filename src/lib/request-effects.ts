import { format } from "date-fns";
import type { RequestType } from "@/lib/constants";
import { Employee, Timesheet } from "@/lib/models";
import { shiftToMinutes } from "@/lib/profile-utils";
import { isHoliday } from "@/lib/holidays";
import { isWeekendDate } from "@/lib/attendance-stats";

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

const ATTENDANCE_TYPES: RequestType[] = ["punch", "leave", "wfh"];

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
    const { normalizeSessions, getOpenSession, syncDerivedFields, computeCheckinStatus } = await import(
      "@/lib/timesheet-session"
    );
    const sessions = normalizeSessions(existing as never);

    if (punchType === "check_in") {
      if (getOpenSession(sessions)) throw new Error("An open check-in session already exists for this date");
      const isFirst = sessions.length === 0;
      sessions.push({ checkIn: punchAt, breaks: [] });
      const derived = syncDerivedFields(sessions, punchAt);
      const holidayWork = await isHoliday(date);
      const weekendWork = isWeekendDate(date);
      dates.push(
        await applyDateEffect(employeeId, date, {
          ...derived,
          sessions,
          source: "manual",
          statusCode: "P",
          ...(isFirst
            ? {
                checkinStatus: computeCheckinStatus(punchAt, shift?.startTime),
                isHolidayWork: holidayWork,
                isWeekendWork: weekendWork,
              }
            : {}),
        }, shift)
      );
    } else if (punchType === "check_out") {
      const open = getOpenSession(sessions);
      if (!open) throw new Error("Cannot check out without an open check-in session");
      if (punchAt.getTime() < new Date(open.checkIn).getTime()) {
        throw new Error("Check-out time must be on or after check-in");
      }
      open.checkOut = punchAt;
      const derived = syncDerivedFields(sessions, punchAt);
      const expectedMinutes = Number(existing?.expectedMinutes ?? expectedMinutesForShift(shift));
      dates.push(
        await applyDateEffect(employeeId, date, {
          ...derived,
          sessions,
          shortMinutes: Math.max(expectedMinutes - derived.workedMinutes, 0),
          source: "manual",
          statusCode: "P",
        }, shift)
      );
    } else {
      throw new Error("Invalid punch type");
    }
  }

  if (type === "leave") {
    // Leave days are marked L and deducted by cron / scoped catch-up, not on approve.
    return { dates: [] };
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

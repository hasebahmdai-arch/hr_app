import { differenceInMinutes, format } from "date-fns";
import { workedMinutesBetween } from "@/lib/profile-utils";

export type SessionState = "not_started" | "working" | "on_break" | "completed";

export interface TimesheetBreak {
  startedAt: Date;
  endedAt?: Date;
}

export function getOpenBreak(breaks: TimesheetBreak[] = []) {
  return breaks.find((b) => !b.endedAt);
}

export function sumBreakMinutes(breaks: TimesheetBreak[] = [], now = new Date()) {
  let total = 0;
  for (const b of breaks) {
    const end = b.endedAt ?? now;
    total += Math.max(differenceInMinutes(end, b.startedAt), 0);
  }
  return total;
}

export function computeNetWorkedMinutes(
  checkIn?: Date | null,
  checkOut?: Date | null,
  _breaks: TimesheetBreak[] = [],
  now = new Date()
) {
  // Work time is continuous from check-in; break time is tracked separately but still counts as work.
  if (!checkIn) return 0;
  const end = checkOut ?? now;
  return workedMinutesBetween(checkIn, end);
}

export function getSessionState(record: {
  checkIn?: Date | null;
  checkOut?: Date | null;
  breaks?: TimesheetBreak[];
} | null): SessionState {
  if (!record?.checkIn) return "not_started";
  if (record.checkOut) return "completed";
  if (getOpenBreak(record.breaks ?? [])) return "on_break";
  return "working";
}

export function formatTimeDisplay(date?: Date | null) {
  if (!date) return undefined;
  return format(date, "HH:mm");
}

export function buildTodaySession(record: {
  checkIn?: Date | null;
  checkOut?: Date | null;
  breaks?: TimesheetBreak[];
  expectedMinutes?: number;
} | null, shift?: { startTime?: string; endTime?: string } | null) {
  const breaks = record?.breaks ?? [];
  const openBreak = getOpenBreak(breaks);
  const breakTotalMinutes = sumBreakMinutes(breaks);
  const state = getSessionState(record);

  return {
    state,
    checkInAt: record?.checkIn?.toISOString(),
    checkOutAt: record?.checkOut?.toISOString(),
    checkInDisplay: formatTimeDisplay(record?.checkIn),
    checkOutDisplay: formatTimeDisplay(record?.checkOut),
    shiftStart: shift?.startTime,
    shiftEnd: shift?.endTime,
    breakTotalMinutes,
    activeBreakStartedAt: openBreak?.startedAt.toISOString(),
    workedMinutesSoFar: computeNetWorkedMinutes(record?.checkIn, record?.checkOut, breaks),
    expectedMinutes: record?.expectedMinutes ?? 480,
  };
}

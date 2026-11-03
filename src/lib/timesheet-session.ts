import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { workedSecondsBetween } from "@/lib/profile-utils";

export type SessionState = "not_started" | "working" | "on_break" | "idle";

export interface TimesheetBreak {
  startedAt: Date;
  endedAt?: Date;
  startIp?: string;
  endIp?: string;
}

export interface WorkSession {
  checkIn: Date;
  checkOut?: Date;
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  checkInIp?: string;
  checkOutIp?: string;
  breaks?: TimesheetBreak[];
}

export type PunchActionType = "check_in" | "check_out" | "break_start" | "break_end";

function companyTimezone() {
  return process.env.COMPANY_TIMEZONE || "Asia/Karachi";
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getOpenBreak(breaks: TimesheetBreak[] = []) {
  return breaks.find((b) => !b.endedAt);
}

export function sumBreakSeconds(breaks: TimesheetBreak[] = [], now = new Date()) {
  let total = 0;
  for (const b of breaks) {
    const end = b.endedAt ?? now;
    total += Math.max(Math.floor((end.getTime() - b.startedAt.getTime()) / 1000), 0);
  }
  return total;
}

export function sumBreakMinutes(breaks: TimesheetBreak[] = [], now = new Date()) {
  return Math.floor(sumBreakSeconds(breaks, now) / 60);
}

/** Normalize legacy single checkIn/out into sessions[]; strip nothing here (DB layer). */
export function normalizeSessions(record: {
  checkIn?: Date | null;
  checkOut?: Date | null;
  breaks?: TimesheetBreak[];
  sessions?: WorkSession[];
} | null): WorkSession[] {
  if (!record) return [];
  if (record.sessions?.length) {
    return record.sessions.map((s) => ({
      ...s,
      checkIn: s.checkIn ? new Date(s.checkIn) : s.checkIn,
      checkOut: s.checkOut ? new Date(s.checkOut) : undefined,
      breaks: (s.breaks ?? []).map((b) => ({
        ...b,
        startedAt: new Date(b.startedAt),
        endedAt: b.endedAt ? new Date(b.endedAt) : undefined,
      })),
    }));
  }
  if (record.checkIn) {
    return [
      {
        checkIn: new Date(record.checkIn),
        checkOut: record.checkOut ? new Date(record.checkOut) : undefined,
        breaks: (record.breaks ?? []).map((b) => ({
          ...b,
          startedAt: new Date(b.startedAt),
          endedAt: b.endedAt ? new Date(b.endedAt) : undefined,
        })),
      },
    ];
  }
  return [];
}

export function getOpenSession(sessions: WorkSession[]) {
  return sessions.find((s) => s.checkIn && !s.checkOut);
}

export function allBreaksFromSessions(sessions: WorkSession[]): TimesheetBreak[] {
  return sessions.flatMap((s) => s.breaks ?? []);
}

/** Gross elapsed minus break seconds for one session. */
export function computeNetWorkedSeconds(
  checkIn?: Date | null,
  checkOut?: Date | null,
  now = new Date(),
  breaks: TimesheetBreak[] = []
) {
  if (!checkIn) return 0;
  const end = checkOut ?? now;
  const gross = workedSecondsBetween(checkIn, end);
  return Math.max(gross - sumBreakSeconds(breaks, now), 0);
}

export function computeNetWorkedMinutes(
  checkIn?: Date | null,
  checkOut?: Date | null,
  now = new Date(),
  breaks: TimesheetBreak[] = []
) {
  return Math.floor(computeNetWorkedSeconds(checkIn, checkOut, now, breaks) / 60);
}

export function computeNetWorkedSecondsFromSessions(sessions: WorkSession[], now = new Date()) {
  let total = 0;
  for (const s of sessions) {
    if (!s.checkIn) continue;
    total += computeNetWorkedSeconds(s.checkIn, s.checkOut, now, s.breaks ?? []);
  }
  return total;
}

export function computeNetWorkedFromSessions(sessions: WorkSession[], now = new Date()) {
  return Math.floor(computeNetWorkedSecondsFromSessions(sessions, now) / 60);
}

export function syncDerivedFields(sessions: WorkSession[], now = new Date()) {
  const first = sessions[0];
  const lastClosed = [...sessions].reverse().find((s) => s.checkOut);
  const open = getOpenSession(sessions);
  const allBreaks = allBreaksFromSessions(sessions);
  const breakSeconds = sumBreakSeconds(allBreaks, now);
  const workedSeconds = computeNetWorkedSecondsFromSessions(sessions, now);
  return {
    checkIn: first?.checkIn,
    checkOut: open ? undefined : lastClosed?.checkOut,
    checkInLocation: first?.checkInLocation,
    checkOutLocation: open ? undefined : lastClosed?.checkOutLocation,
    breaks: allBreaks,
    breakSeconds,
    breakMinutes: Math.floor(breakSeconds / 60),
    workedSeconds,
    workedMinutes: Math.floor(workedSeconds / 60),
  };
}

export function getSessionState(record: {
  checkIn?: Date | null;
  checkOut?: Date | null;
  breaks?: TimesheetBreak[];
  sessions?: WorkSession[];
} | null): SessionState {
  const sessions = normalizeSessions(record);
  if (!sessions.length) return "not_started";
  const open = getOpenSession(sessions);
  if (!open) return "idle";
  if (getOpenBreak(open.breaks ?? [])) return "on_break";
  return "working";
}

export function formatTimeDisplay(date?: Date | null) {
  if (!date) return undefined;
  return format(toZonedTime(date, companyTimezone()), "h:mm a");
}

const LATE_GRACE_MINUTES = 30;

export function computeCheckinStatus(
  checkIn: Date,
  shiftStart?: string | null
): "On Time" | "Late" {
  if (!shiftStart) return "On Time";
  const parts = shiftStart.split(":").map(Number);
  const sh = parts[0] ?? 0;
  const sm = parts[1] ?? 0;
  const zoned = toZonedTime(checkIn, companyTimezone());
  const checkMinutes = zoned.getHours() * 60 + zoned.getMinutes();
  const shiftMinutes = sh * 60 + sm;
  return checkMinutes > shiftMinutes + LATE_GRACE_MINUTES ? "Late" : "On Time";
}

const NON_ABSENT_CODES = new Set(["L", "SL", "W", "H", "D", "O", "T"]);

export function isAbsentToday(record: {
  checkIn?: Date | null;
  sessions?: WorkSession[];
  statusCode?: string;
} | null) {
  if (!record) return true;
  const sessions = normalizeSessions(record);
  if (sessions.length > 0 || record.checkIn) return false;
  if (record.statusCode && NON_ABSENT_CODES.has(record.statusCode)) return false;
  return true;
}

/** Public session DTO — never includes IP fields. */
export function sanitizeSessionsForClient(sessions: WorkSession[]) {
  return sessions.map((s) => ({
    checkIn: s.checkIn?.toISOString?.() ?? (s.checkIn as unknown as string),
    checkOut: s.checkOut?.toISOString?.() ?? (s.checkOut as unknown as string | undefined),
    checkInDisplay: formatTimeDisplay(s.checkIn ? new Date(s.checkIn) : null),
    checkOutDisplay: formatTimeDisplay(s.checkOut ? new Date(s.checkOut) : null),
    breaks: (s.breaks ?? []).map((b) => ({
      startedAt: b.startedAt instanceof Date ? b.startedAt.toISOString() : String(b.startedAt),
      endedAt: b.endedAt
        ? b.endedAt instanceof Date
          ? b.endedAt.toISOString()
          : String(b.endedAt)
        : undefined,
      startedDisplay: formatTimeDisplay(new Date(b.startedAt)),
      endedDisplay: b.endedAt ? formatTimeDisplay(new Date(b.endedAt)) : undefined,
    })),
  }));
}

export function buildTodaySession(
  record: {
    checkIn?: Date | null;
    checkOut?: Date | null;
    breaks?: TimesheetBreak[];
    sessions?: WorkSession[];
    expectedMinutes?: number;
    checkinStatus?: string;
    checkoutStatus?: string;
    statusCode?: string;
  } | null,
  shift?: { startTime?: string; endTime?: string } | null
) {
  const sessions = normalizeSessions(record);
  const open = getOpenSession(sessions);
  const allBreaks = allBreaksFromSessions(sessions);
  const openBreak = open ? getOpenBreak(open.breaks ?? []) : undefined;
  const breakTotalSeconds = sumBreakSeconds(allBreaks);
  const workedSecondsSoFar = computeNetWorkedSecondsFromSessions(sessions);
  const state = getSessionState(record);
  const first = sessions[0];
  const lastClosed = [...sessions].reverse().find((s) => s.checkOut);

  return {
    state,
    checkInAt: first?.checkIn?.toISOString(),
    checkOutAt: open ? undefined : lastClosed?.checkOut?.toISOString(),
    checkInDisplay: formatTimeDisplay(first?.checkIn),
    checkOutDisplay: open ? undefined : formatTimeDisplay(lastClosed?.checkOut),
    shiftStart: shift?.startTime,
    shiftEnd: shift?.endTime,
    breakTotalSeconds,
    breakTotalMinutes: Math.floor(breakTotalSeconds / 60),
    activeBreakStartedAt: openBreak?.startedAt.toISOString(),
    workedSecondsSoFar,
    workedMinutesSoFar: Math.floor(workedSecondsSoFar / 60),
    expectedMinutes: record?.expectedMinutes ?? 480,
    checkinStatus: record?.checkinStatus,
    checkoutStatus: record?.checkoutStatus,
    isAbsent: isAbsentToday(record),
    isLate: record?.checkinStatus === "Late",
    isMissedCheckout: record?.checkoutStatus === "Missed",
    sessions: sanitizeSessionsForClient(sessions),
  };
}

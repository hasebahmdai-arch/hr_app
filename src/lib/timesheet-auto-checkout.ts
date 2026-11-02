import { format, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import connectDB from "@/lib/db";
import { PunchEvent, Timesheet } from "@/lib/models";
import {
  computeNetWorkedFromSessions,
  getOpenBreak,
  getOpenSession,
  normalizeSessions,
  sumBreakMinutes,
  syncDerivedFields,
  type WorkSession,
} from "@/lib/timesheet-session";

function companyTimezone() {
  return process.env.COMPANY_TIMEZONE || "Asia/Karachi";
}

/** Today's date string in company timezone (yyyy-MM-dd). */
export function todayInCompanyTz(now = new Date()) {
  const zoned = toZonedTime(now, companyTimezone());
  return format(zoned, "yyyy-MM-dd");
}

/** End of a calendar day (23:59:59.999) in company timezone, as a UTC Date. */
export function endOfDayInCompanyTz(dateStr: string) {
  return fromZonedTime(`${dateStr}T23:59:59.999`, companyTimezone());
}

/**
 * Auto check-out any open sessions from previous days at local midnight
 * (end of that timesheet's date in COMPANY_TIMEZONE).
 */
export async function autoCheckoutForgottenSessions(employeeId?: string) {
  await connectDB();
  const today = todayInCompanyTz();
  const filter: Record<string, unknown> = { date: { $lt: today } };
  if (employeeId) filter.employeeId = employeeId;

  const candidates = await Timesheet.find(filter);
  const open = candidates.filter((record) => {
    const sessions = normalizeSessions(record.toObject());
    if (getOpenSession(sessions)) return true;
    return Boolean(record.checkIn && !record.checkOut);
  });
  let closed = 0;

  for (const record of open) {
    const checkoutAt = endOfDayInCompanyTz(record.date);
    const sessions = normalizeSessions(record.toObject());
    const openSession = getOpenSession(sessions);

    if (!openSession) {
      // Legacy open checkOut without sessions
      if (record.checkIn && !record.checkOut) {
        if (checkoutAt.getTime() < new Date(record.checkIn).getTime()) continue;
        const breaks = (record.breaks as { startedAt: Date; endedAt?: Date }[]) ?? [];
        const openBreak = getOpenBreak(breaks);
        if (openBreak) openBreak.endedAt = checkoutAt;
        record.breaks = breaks as never;
        record.checkOut = checkoutAt;
        record.breakMinutes = sumBreakMinutes(breaks, checkoutAt);
        record.workedMinutes = computeNetWorkedFromSessions(
          [
            {
              checkIn: new Date(record.checkIn),
              checkOut: checkoutAt,
              breaks,
            },
          ],
          checkoutAt
        );
        record.checkoutStatus = "Missed";
        const expected = record.expectedMinutes ?? 480;
        record.shortMinutes = Math.max(expected - record.workedMinutes, 0);
        await record.save();
        await PunchEvent.create({
          employeeId: record.employeeId,
          timesheetId: record._id,
          date: record.date,
          action: "check_out",
          at: checkoutAt,
          ip: "system",
        });
        closed++;
      }
      continue;
    }

    if (checkoutAt.getTime() < new Date(openSession.checkIn).getTime()) {
      continue;
    }

    const breaks = openSession.breaks ?? [];
    const openBreak = getOpenBreak(breaks);
    if (openBreak) {
      openBreak.endedAt = checkoutAt;
      openSession.breaks = breaks;
    }
    openSession.checkOut = checkoutAt;
    openSession.checkOutIp = "system";

    const derived = syncDerivedFields(sessions, checkoutAt);
    record.sessions = sessions as never;
    record.breaks = derived.breaks as never;
    record.breakMinutes = derived.breakMinutes;
    record.workedMinutes = derived.workedMinutes;
    record.checkIn = derived.checkIn;
    record.checkOut = derived.checkOut;
    record.checkInLocation = derived.checkInLocation as never;
    record.checkOutLocation = derived.checkOutLocation as never;
    record.checkoutStatus = "Missed";
    const expected = record.expectedMinutes ?? 480;
    record.shortMinutes = Math.max(expected - record.workedMinutes, 0);
    if (!record.statusCode || record.statusCode === "P") {
      record.statusCode = "P";
    }
    record.source = record.source || "punch";
    await record.save();

    await PunchEvent.create({
      employeeId: record.employeeId,
      timesheetId: record._id,
      date: record.date,
      action: "check_out",
      at: checkoutAt,
      ip: "system",
    });
    closed++;
  }

  return { closed, today };
}

export function parseTimesheetDate(dateStr: string) {
  return parseISO(dateStr);
}

/** Ensure sessions array exists when reading/writing older docs. */
export function ensureSessionsOnRecord(record: {
  sessions?: WorkSession[];
  checkIn?: Date | null;
  checkOut?: Date | null;
  breaks?: { startedAt: Date; endedAt?: Date }[];
}): WorkSession[] {
  return normalizeSessions(record);
}

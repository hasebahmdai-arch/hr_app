import { format, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import connectDB from "@/lib/db";
import { Timesheet } from "@/lib/models";
import {
  computeNetWorkedMinutes,
  getOpenBreak,
  sumBreakMinutes,
  type TimesheetBreak,
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
  const filter: Record<string, unknown> = {
    checkIn: { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    date: { $lt: today },
  };
  if (employeeId) filter.employeeId = employeeId;

  const open = await Timesheet.find(filter);
  let closed = 0;

  for (const record of open) {
    const checkoutAt = endOfDayInCompanyTz(record.date);
    // Don't checkout before check-in (clock skew / bad data)
    if (record.checkIn && checkoutAt.getTime() < new Date(record.checkIn).getTime()) {
      continue;
    }

    const breaks: TimesheetBreak[] = (record.breaks as TimesheetBreak[]) ?? [];
    const openBreak = getOpenBreak(breaks);
    if (openBreak) {
      openBreak.endedAt = checkoutAt;
      record.breaks = breaks as never;
    }

    record.checkOut = checkoutAt;
    record.breakMinutes = sumBreakMinutes(breaks, checkoutAt);
    record.workedMinutes = computeNetWorkedMinutes(record.checkIn, checkoutAt);
    const expected = record.expectedMinutes ?? 480;
    record.shortMinutes = Math.max(expected - record.workedMinutes, 0);
    if (!record.statusCode || record.statusCode === "P") {
      record.statusCode = "P";
    }
    record.source = record.source || "punch";
    await record.save();
    closed++;
  }

  return { closed, today };
}

export function parseTimesheetDate(dateStr: string) {
  return parseISO(dateStr);
}

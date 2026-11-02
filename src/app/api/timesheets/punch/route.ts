import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee, PunchEvent, Timesheet } from "@/lib/models";
import { shiftToMinutes } from "@/lib/profile-utils";
import { handleRouteError } from "@/lib/route-utils";
import { isHoliday } from "@/lib/holidays";
import { isWeekendDate } from "@/lib/attendance-stats";
import { processLeaveDeductionsForEmployee } from "@/lib/leave-deduct";
import {
  autoCheckoutForgottenSessions,
  todayInCompanyTz,
} from "@/lib/timesheet-auto-checkout";
import {
  buildTodaySession,
  computeCheckinStatus,
  computeNetWorkedFromSessions,
  getClientIp,
  getOpenBreak,
  getOpenSession,
  normalizeSessions,
  sumBreakMinutes,
  syncDerivedFields,
  type PunchActionType,
  type WorkSession,
} from "@/lib/timesheet-session";
import { punchSchema } from "@/lib/validations";

async function logPunchEvent(params: {
  employeeId: string;
  timesheetId: unknown;
  date: string;
  action: PunchActionType;
  at: Date;
  ip: string;
  location?: { lat: number; lng: number };
}) {
  await PunchEvent.create({
    employeeId: params.employeeId,
    timesheetId: params.timesheetId,
    date: params.date,
    action: params.action,
    at: params.at,
    ip: params.ip,
    location: params.location,
  });
}

function applyDerived(record: InstanceType<typeof Timesheet>, sessions: WorkSession[], now: Date, expectedMinutes: number) {
  const derived = syncDerivedFields(sessions, now);
  record.sessions = sessions as never;
  record.breaks = derived.breaks as never;
  record.breakMinutes = derived.breakMinutes;
  record.workedMinutes = derived.workedMinutes;
  record.checkIn = derived.checkIn;
  record.checkInLocation = derived.checkInLocation as never;
  if (derived.checkOut) {
    record.checkOut = derived.checkOut;
    record.checkOutLocation = derived.checkOutLocation as never;
    record.shortMinutes = Math.max(expectedMinutes - derived.workedMinutes, 0);
  } else {
    record.set("checkOut", undefined);
    record.set("checkOutLocation", undefined);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = punchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid punch data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    await autoCheckoutForgottenSessions(session.user.id);
    await processLeaveDeductionsForEmployee(session.user.id);

    const today = todayInCompanyTz();
    const now = new Date();
    const ip = getClientIp(req);
    const { action } = parsed.data;
    const location =
      parsed.data.lat !== undefined && parsed.data.lng !== undefined
        ? { lat: parsed.data.lat, lng: parsed.data.lng }
        : undefined;

    const employee = await Employee.findById(session.user.id).populate("shiftId");
    const shift = employee?.shiftId as {
      _id?: unknown;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
    } | null;
    const expectedMinutes =
      shift?.startTime && shift?.endTime
        ? shiftToMinutes(shift.startTime, shift.endTime, shift.breakMinutes ?? 60)
        : 480;

    let record = await Timesheet.findOne({ employeeId: session.user.id, date: today });
    const sessions = normalizeSessions(record?.toObject() ?? null);

    if (action === "check_in") {
      if (getOpenSession(sessions)) {
        return apiError("Already checked in — check out first", "ALREADY_CHECKED_IN", 400);
      }

      const isFirstOfDay = sessions.length === 0;
      const newSession: WorkSession = {
        checkIn: now,
        checkInLocation: location,
        checkInIp: ip,
        breaks: [],
      };
      sessions.push(newSession);

      const holidayWork = isFirstOfDay ? await isHoliday(today) : false;
      const weekendWork = isFirstOfDay ? isWeekendDate(today) : false;

      if (record) {
        record.expectedMinutes = expectedMinutes;
        record.source = "punch";
        if (!record.statusCode || record.statusCode === "A" || record.statusCode === "H" || record.statusCode === "L") {
          record.statusCode = "P";
        }
        if (isFirstOfDay) {
          record.checkinStatus = computeCheckinStatus(now, shift?.startTime);
          record.set("checkoutStatus", undefined);
          record.isHolidayWork = holidayWork;
          record.isWeekendWork = weekendWork;
        }
        applyDerived(record, sessions, now, expectedMinutes);
        await record.save();
      } else {
        record = await Timesheet.create({
          employeeId: session.user.id,
          date: today,
          shiftId: shift?._id,
          expectedMinutes,
          source: "punch",
          statusCode: "P",
          checkinStatus: computeCheckinStatus(now, shift?.startTime),
          isHolidayWork: holidayWork,
          isWeekendWork: weekendWork,
          sessions,
          ...syncDerivedFields(sessions, now),
        });
      }

      await logPunchEvent({
        employeeId: session.user.id,
        timesheetId: record._id,
        date: today,
        action: "check_in",
        at: now,
        ip,
        location,
      });

      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (!sessions.length) {
      return apiError("Check in first", "NOT_CHECKED_IN", 400);
    }

    const openSession = getOpenSession(sessions);
    if (!openSession) {
      return apiError("Check in first to continue", "NOT_CHECKED_IN", 400);
    }

    if (!record) {
      return apiError("Check in first", "NOT_CHECKED_IN", 400);
    }

    const breaks = openSession.breaks ?? [];
    const openBreak = getOpenBreak(breaks);

    if (action === "break_start") {
      if (openBreak) return apiError("Break already in progress", "BREAK_IN_PROGRESS", 400);
      breaks.push({ startedAt: now, startIp: ip });
      openSession.breaks = breaks;
      applyDerived(record, sessions, now, expectedMinutes);
      await record.save();
      await logPunchEvent({
        employeeId: session.user.id,
        timesheetId: record._id,
        date: today,
        action: "break_start",
        at: now,
        ip,
        location,
      });
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (action === "break_end") {
      if (!openBreak) return apiError("No break in progress", "NO_BREAK", 400);
      openBreak.endedAt = now;
      openBreak.endIp = ip;
      openSession.breaks = breaks;
      applyDerived(record, sessions, now, expectedMinutes);
      await record.save();
      await logPunchEvent({
        employeeId: session.user.id,
        timesheetId: record._id,
        date: today,
        action: "break_end",
        at: now,
        ip,
        location,
      });
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (action === "check_out") {
      if (openBreak) {
        openBreak.endedAt = now;
        openBreak.endIp = ip;
        openSession.breaks = breaks;
      }
      openSession.checkOut = now;
      openSession.checkOutLocation = location;
      openSession.checkOutIp = ip;
      applyDerived(record, sessions, now, expectedMinutes);
      record.workedMinutes = computeNetWorkedFromSessions(sessions, now);
      record.breakMinutes = sumBreakMinutes(
        sessions.flatMap((s) => s.breaks ?? []),
        now
      );
      record.shortMinutes = Math.max(expectedMinutes - record.workedMinutes, 0);
      await record.save();
      await logPunchEvent({
        employeeId: session.user.id,
        timesheetId: record._id,
        date: today,
        action: "check_out",
        at: now,
        ip,
        location,
      });
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    return apiError("Invalid action", "VALIDATION_ERROR", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}

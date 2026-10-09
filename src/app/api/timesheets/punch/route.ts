import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee, Timesheet } from "@/lib/models";
import { shiftToMinutes } from "@/lib/profile-utils";
import { handleRouteError } from "@/lib/route-utils";
import {
  autoCheckoutForgottenSessions,
  todayInCompanyTz,
} from "@/lib/timesheet-auto-checkout";
import {
  buildTodaySession,
  computeNetWorkedMinutes,
  getOpenBreak,
  sumBreakMinutes,
  type TimesheetBreak,
} from "@/lib/timesheet-session";
import { punchSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = punchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid punch data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    // Close any previous-day open sessions at local midnight before punching today
    await autoCheckoutForgottenSessions(session.user.id);

    const today = todayInCompanyTz();
    const now = new Date();
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

    if (action === "check_in") {
      if (record?.checkIn) {
        return apiError("Already checked in for today", "ALREADY_CHECKED_IN", 400);
      }

      if (record) {
        // Existing row (e.g. leave marker) — update instead of create to avoid duplicate key
        record.checkIn = now;
        record.checkInLocation = location;
        record.expectedMinutes = expectedMinutes;
        record.breakMinutes = 0;
        record.breaks = [] as never;
        record.source = "punch";
        record.statusCode = "P";
        record.set("checkOut", undefined);
        record.set("checkOutLocation", undefined);
        await record.save();
      } else {
        record = await Timesheet.create({
          employeeId: session.user.id,
          date: today,
          shiftId: shift?._id,
          checkIn: now,
          checkInLocation: location,
          expectedMinutes,
          breakMinutes: 0,
          breaks: [],
          source: "punch",
          statusCode: "P",
        });
      }
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (!record?.checkIn) {
      return apiError("Check in first", "NOT_CHECKED_IN", 400);
    }

    const breaks: TimesheetBreak[] = (record.breaks as TimesheetBreak[]) ?? [];
    const openBreak = getOpenBreak(breaks);

    if (action === "break_start") {
      if (record.checkOut) return apiError("Already checked out", "ALREADY_PUNCHED_OUT", 400);
      if (openBreak) return apiError("Break already in progress", "BREAK_IN_PROGRESS", 400);
      breaks.push({ startedAt: now });
      record.breaks = breaks as never;
      record.breakMinutes = sumBreakMinutes(breaks);
      await record.save();
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (action === "break_end") {
      if (!openBreak) return apiError("No break in progress", "NO_BREAK", 400);
      openBreak.endedAt = now;
      record.breaks = breaks as never;
      record.breakMinutes = sumBreakMinutes(breaks);
      await record.save();
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    if (action === "check_out") {
      if (record.checkOut) return apiError("Already checked out for today", "ALREADY_PUNCHED_OUT", 400);
      if (openBreak) {
        openBreak.endedAt = now;
        record.breaks = breaks as never;
      }
      record.checkOut = now;
      record.checkOutLocation = location;
      record.breakMinutes = sumBreakMinutes(breaks);
      record.workedMinutes = computeNetWorkedMinutes(record.checkIn, record.checkOut);
      record.shortMinutes = Math.max(expectedMinutes - record.workedMinutes, 0);
      await record.save();
      return apiSuccess({ action, session: buildTodaySession(record.toObject(), shift) });
    }

    return apiError("Invalid action", "VALIDATION_ERROR", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}

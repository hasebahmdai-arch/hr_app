import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee, Timesheet } from "@/lib/models";
import {
  computeAttendancePct,
  dateToCheckInMinutes,
  minutesToTimeLabel,
  shiftToMinutes,
} from "@/lib/profile-utils";
import { handleRouteError } from "@/lib/route-utils";
import type { DashboardAttendanceResponse } from "@/types/api";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return apiError("Invalid month format. Use YYYY-MM", "VALIDATION_ERROR", 400);
    }

    await connectDB();
    const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
    const monthEnd = endOfMonth(monthStart);
    const dateFrom = format(monthStart, "yyyy-MM-dd");
    const dateTo = format(monthEnd, "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");

    const employee = await Employee.findById(session.user.id).populate("shiftId");
    const shift = employee?.shiftId as { startTime?: string; endTime?: string; breakMinutes?: number } | null;

    const records = await Timesheet.find({
      employeeId: session.user.id,
      date: { $gte: dateFrom, $lte: dateTo },
    }).sort({ date: 1 });

    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    const statusCounters: Record<string, number> = {};
    const anomalyCounters: Record<string, number> = {};
    let workedMinutes = 0;
    let expectedMinutes = 0;
    let shortMinutes = 0;
    let breakMinutes = 0;

    for (const r of records) {
      statusCounters[r.statusCode] = (statusCounters[r.statusCode] || 0) + 1;
      workedMinutes += r.workedMinutes || 0;
      expectedMinutes += r.expectedMinutes || 0;
      shortMinutes += r.shortMinutes || 0;
      breakMinutes += r.breakMinutes || 0;
      if (r.checkinStatus && r.checkinStatus !== "on_time") {
        anomalyCounters[r.checkinStatus] = (anomalyCounters[r.checkinStatus] || 0) + 1;
      }
      if (r.checkoutStatus && r.checkoutStatus !== "on_time") {
        anomalyCounters[r.checkoutStatus] = (anomalyCounters[r.checkoutStatus] || 0) + 1;
      }
    }

    const shiftWorkedMinutes = shift?.startTime && shift?.endTime
      ? shiftToMinutes(shift.startTime, shift.endTime, shift.breakMinutes ?? 60)
      : 480;

    const trends = records.map((r) => ({
      date: r.date,
      checkInMinutes: dateToCheckInMinutes(r.checkIn),
    }));

    const todayRecord = records.find((r) => r.date === today);

    const response: DashboardAttendanceResponse = {
      month,
      attendancePct: computeAttendancePct(records, monthDays),
      shiftMetrics: {
        totalShifts: records.length,
        expectedMinutes,
        workedMinutes,
        shortMinutes,
        shiftWorkedMinutes,
        breakMinutes,
      },
      statusCounters,
      anomalyCounters,
      trends,
      todayRecord: todayRecord
        ? {
            checkIn: todayRecord.checkIn?.toISOString(),
            checkOut: todayRecord.checkOut?.toISOString(),
            checkInDisplay: todayRecord.checkIn
              ? minutesToTimeLabel(dateToCheckInMinutes(todayRecord.checkIn)) ?? undefined
              : undefined,
            checkOutDisplay: todayRecord.checkOut
              ? minutesToTimeLabel(dateToCheckInMinutes(todayRecord.checkOut)) ?? undefined
              : undefined,
            shiftStart: shift?.startTime,
            shiftEnd: shift?.endTime,
          }
        : shift
          ? { shiftStart: shift.startTime, shiftEnd: shift.endTime }
          : undefined,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

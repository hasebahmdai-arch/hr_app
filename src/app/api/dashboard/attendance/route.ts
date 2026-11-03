import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { computeStatTiles } from "@/lib/attendance-stats";
import connectDB from "@/lib/db";
import { getHolidayDatesInRange } from "@/lib/holidays";
import { ensureYearBalances, summarizeBalances } from "@/lib/leave-balance";
import { Employee, Timesheet } from "@/lib/models";
import {
  dateToCheckInMinutes,
  shiftToMinutes,
} from "@/lib/profile-utils";
import { handleRouteError } from "@/lib/route-utils";
import { todayInCompanyTz } from "@/lib/timesheet-auto-checkout";
import { formatTimeDisplay } from "@/lib/timesheet-session";
import type { DashboardAttendanceResponse } from "@/types/api";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const today = todayInCompanyTz();
    const month = searchParams.get("month") || today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return apiError("Invalid month format. Use YYYY-MM", "VALIDATION_ERROR", 400);
    }

    await connectDB();
    const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
    const monthEnd = endOfMonth(monthStart);
    const dateFrom = format(monthStart, "yyyy-MM-dd");
    const dateTo = format(monthEnd, "yyyy-MM-dd");
    const year = monthStart.getFullYear();

    const [employee, records, holidays, balances] = await Promise.all([
      Employee.findById(session.user.id).populate("shiftId").select("shiftId hireDate leaveBalances"),
      Timesheet.find({
        employeeId: session.user.id,
        date: { $gte: dateFrom, $lte: dateTo },
      })
        .select(
          "date statusCode checkIn checkOut sessions checkinStatus checkoutStatus workedMinutes expectedMinutes shortMinutes breakMinutes isWeekendWork isHolidayWork"
        )
        .sort({ date: 1 })
        .lean(),
      getHolidayDatesInRange(dateFrom, dateTo),
      ensureYearBalances(session.user.id, year),
    ]);

    const shift = employee?.shiftId as { startTime?: string; endTime?: string; breakMinutes?: number } | null;
    const holidaySet = new Set(holidays.map((h) => h.date));

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
      if (r.checkinStatus) {
        anomalyCounters[r.checkinStatus] = (anomalyCounters[r.checkinStatus] || 0) + 1;
      }
      if (r.checkoutStatus) {
        anomalyCounters[r.checkoutStatus] = (anomalyCounters[r.checkoutStatus] || 0) + 1;
      }
    }

    const shiftWorkedMinutes =
      shift?.startTime && shift?.endTime
        ? shiftToMinutes(shift.startTime, shift.endTime, shift.breakMinutes ?? 60)
        : 480;

    const trends = records.map((r) => ({
      date: r.date,
      checkInMinutes: dateToCheckInMinutes(r.checkIn),
    }));

    const todayRecord = records.find((r) => r.date === today);
    const statTiles = computeStatTiles({
      month,
      records: records as never,
      holidayDates: holidaySet,
      hireDate: employee?.hireDate,
    });

    const response: DashboardAttendanceResponse = {
      month,
      attendancePct: statTiles.attendancePct,
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
      statTiles,
      holidays,
      leaveBalances: summarizeBalances(balances, year),
      trends,
      todayRecord: todayRecord
        ? {
            checkIn: todayRecord.checkIn ? new Date(todayRecord.checkIn).toISOString() : undefined,
            checkOut: todayRecord.checkOut ? new Date(todayRecord.checkOut).toISOString() : undefined,
            checkInDisplay: formatTimeDisplay(todayRecord.checkIn ? new Date(todayRecord.checkIn) : null) ?? undefined,
            checkOutDisplay: formatTimeDisplay(todayRecord.checkOut ? new Date(todayRecord.checkOut) : null) ?? undefined,
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

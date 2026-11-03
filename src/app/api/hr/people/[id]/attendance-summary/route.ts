import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import { computeStatTiles } from "@/lib/attendance-stats";
import connectDB from "@/lib/db";
import { getHolidayDatesInRange } from "@/lib/holidays";
import { ensureYearBalances, summarizeBalances } from "@/lib/leave-balance";
import { Employee, Timesheet } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import type { HrPersonAttendanceSummary } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireHR();
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return apiError("Invalid month format. Use YYYY-MM", "VALIDATION_ERROR", 400);
    }

    await connectDB();
    const employee = await Employee.findById(id)
      .select("firstName lastName employeeCode hireDate leaveBalances")
      .lean();
    if (!employee) {
      return apiError("Employee not found", "NOT_FOUND", 404);
    }

    const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
    const monthEnd = endOfMonth(monthStart);
    const dateFrom = format(monthStart, "yyyy-MM-dd");
    const dateTo = format(monthEnd, "yyyy-MM-dd");
    const year = monthStart.getFullYear();

    const [records, holidays, balances] = await Promise.all([
      Timesheet.find({
        employeeId: id,
        date: { $gte: dateFrom, $lte: dateTo },
      })
        .select(
          "date statusCode checkIn checkOut sessions checkinStatus checkoutStatus isWeekendWork isHolidayWork"
        )
        .lean(),
      getHolidayDatesInRange(dateFrom, dateTo),
      ensureYearBalances(id, year),
    ]);

    const holidaySet = new Set(holidays.map((h) => h.date));
    const statTiles = computeStatTiles({
      month,
      records: records as never,
      holidayDates: holidaySet,
      hireDate: employee.hireDate,
    });

    const response: HrPersonAttendanceSummary = {
      employeeId: id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode,
      month,
      dateFrom,
      dateTo,
      statTiles,
      leaveBalances: summarizeBalances(balances, year),
      holidays,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

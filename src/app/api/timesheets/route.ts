import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Timesheet } from "@/lib/models";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import {
  isAbsentToday,
  normalizeSessions,
  sanitizeSessionsForClient,
} from "@/lib/timesheet-session";
import type { PaginatedResponse } from "@/types/api";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const filter: Record<string, unknown> = {};

    if (session.user.role === "hr") {
      const employeeId = searchParams.get("employeeId");
      if (employeeId) filter.employeeId = employeeId;
    } else {
      filter.employeeId = session.user.id;
    }

    const status = searchParams.get("status");
    if (status) filter.statusCode = status;

    const flag = searchParams.get("flag");
    if (flag === "late") filter.checkinStatus = "Late";
    else if (flag === "missedCheckout") filter.checkoutStatus = "Missed";
    else if (flag === "weekendWork") filter.isWeekendWork = true;
    else if (flag === "holidayWork") filter.isHolidayWork = true;

    const source = searchParams.get("source");
    if (source) filter.source = source;

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) (filter.date as Record<string, string>).$gte = dateFrom;
      if (dateTo) (filter.date as Record<string, string>).$lte = dateTo;
    }

    const checkInFrom = searchParams.get("checkInFrom");
    const checkInTo = searchParams.get("checkInTo");
    if (checkInFrom || checkInTo) {
      filter.checkIn = {};
      if (checkInFrom) (filter.checkIn as Record<string, Date>).$gte = new Date(checkInFrom);
      if (checkInTo) (filter.checkIn as Record<string, Date>).$lte = new Date(checkInTo);
    }

    const manualFlag = searchParams.get("manualFlag");
    if (manualFlag === "true") filter.source = "manual";

    await connectDB();
    const [items, total] = await Promise.all([
      Timesheet.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate("employeeId", "firstName lastName employeeCode")
        .lean(),
      Timesheet.countDocuments(filter),
    ]);

    const response: PaginatedResponse<Record<string, unknown>> = {
      items: items.map((t) => {
        const emp = t.employeeId as { _id?: { toString(): string }; firstName?: string; lastName?: string; employeeCode?: string } | null;
        const sessions = normalizeSessions(t as never);
        const { sessions: _rawSessions, breaks: _rawBreaks, ...rest } = t as Record<string, unknown> & {
          sessions?: unknown;
          breaks?: unknown;
        };
        void _rawSessions;
        void _rawBreaks;
        return {
          ...rest,
          _id: t._id.toString(),
          employeeId: emp?._id?.toString?.() ?? (t.employeeId as { toString(): string })?.toString?.(),
          employee:
            emp && typeof emp === "object" && emp.firstName
              ? { firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode }
              : undefined,
          shiftId: t.shiftId?.toString(),
          checkIn: t.checkIn?.toISOString(),
          checkOut: t.checkOut?.toISOString(),
          checkinStatus: t.checkinStatus,
          checkoutStatus: t.checkoutStatus,
          isAbsent: isAbsentToday(t as never),
          isLate: t.checkinStatus === "Late",
          isMissedCheckout: t.checkoutStatus === "Missed",
          sessions: sanitizeSessionsForClient(sessions),
        };
      }),
      total,
      page,
      limit,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

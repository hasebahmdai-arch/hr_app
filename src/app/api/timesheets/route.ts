import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Timesheet } from "@/lib/models";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import type { PaginatedResponse } from "@/types/api";

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
        return {
          ...t,
          _id: t._id.toString(),
          employeeId: emp?._id?.toString?.() ?? (t.employeeId as { toString(): string })?.toString?.(),
          employee:
            emp && typeof emp === "object" && emp.firstName
              ? { firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode }
              : undefined,
          shiftId: t.shiftId?.toString(),
          checkIn: t.checkIn?.toISOString(),
          checkOut: t.checkOut?.toISOString(),
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

import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { PunchEvent } from "@/lib/models";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import { formatTimeDisplay } from "@/lib/timesheet-session";
import type { PaginatedResponse } from "@/types/api";

/** Returns punch history without IP fields. */
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

    const date = searchParams.get("date");
    if (date) filter.date = date;

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) (filter.date as Record<string, string>).$gte = dateFrom;
      if (dateTo) (filter.date as Record<string, string>).$lte = dateTo;
    }

    await connectDB();
    const [items, total] = await Promise.all([
      PunchEvent.find(filter).sort({ at: -1 }).skip(skip).limit(limit).lean(),
      PunchEvent.countDocuments(filter),
    ]);

    const response: PaginatedResponse<Record<string, unknown>> = {
      items: items.map((e) => ({
        _id: e._id.toString(),
        employeeId: e.employeeId.toString(),
        timesheetId: e.timesheetId?.toString(),
        date: e.date,
        action: e.action,
        at: e.at?.toISOString(),
        atDisplay: formatTimeDisplay(e.at),
        // ip intentionally omitted
      })),
      total,
      page,
      limit,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { format, endOfMonth, startOfMonth } from "date-fns";
import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getHolidayDatesInRange } from "@/lib/holidays";
import { handleRouteError } from "@/lib/route-utils";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const from = searchParams.get("from") || format(startOfMonth(now), "yyyy-MM-dd");
    const to = searchParams.get("to") || format(endOfMonth(now), "yyyy-MM-dd");

    await connectDB();
    const holidays = await getHolidayDatesInRange(from, to);
    return apiSuccess(holidays);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee, Timesheet } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import {
  autoCheckoutForgottenSessions,
  todayInCompanyTz,
} from "@/lib/timesheet-auto-checkout";
import { buildTodaySession } from "@/lib/timesheet-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    await connectDB();
    await autoCheckoutForgottenSessions(session.user.id);

    const today = todayInCompanyTz();
    const employee = await Employee.findById(session.user.id).populate("shiftId");
    const shift = employee?.shiftId as { startTime?: string; endTime?: string } | null;
    const record = await Timesheet.findOne({ employeeId: session.user.id, date: today }).lean();

    return apiSuccess(buildTodaySession(record, shift));
  } catch (error) {
    return handleRouteError(error);
  }
}

import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  ensureYearBalances,
  getAvailableRemaining,
  getAvailableWfhRemaining,
  summarizeBalances,
} from "@/lib/leave-balance";
import { handleRouteError } from "@/lib/route-utils";
import { yearInCompanyTz } from "@/lib/timesheet-auto-checkout";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    await connectDB();
    const year = yearInCompanyTz();
    const balances = await ensureYearBalances(session.user.id, year);
    const summary = summarizeBalances(balances, year);
    const withAvailable = await Promise.all(
      summary.map(async (row) => ({
        ...row,
        available:
          row.leaveType === "WFH"
            ? await getAvailableWfhRemaining(session.user.id, year)
            : await getAvailableRemaining(session.user.id, row.leaveType, year),
      }))
    );
    return apiSuccess({ year, balances: withAvailable });
  } catch (error) {
    return handleRouteError(error);
  }
}

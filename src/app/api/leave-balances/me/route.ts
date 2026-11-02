import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ensureYearBalances, getAvailableRemaining, summarizeBalances } from "@/lib/leave-balance";
import { handleRouteError } from "@/lib/route-utils";

export async function GET() {
  try {
    const session = await requireSession();
    await connectDB();
    const year = new Date().getFullYear();
    const balances = await ensureYearBalances(session.user.id, year);
    const summary = summarizeBalances(balances, year);
    const withAvailable = await Promise.all(
      summary.map(async (row) => ({
        ...row,
        available: await getAvailableRemaining(session.user.id, row.leaveType, year),
      }))
    );
    return apiSuccess({ year, balances: withAvailable });
  } catch (error) {
    return handleRouteError(error);
  }
}

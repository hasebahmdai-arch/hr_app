import { apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import { getHrRequestsSummary } from "@/lib/hr-reports";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "10", 10));
    const data = await getHrRequestsSummary(limit);
    return apiSuccess(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { format } from "date-fns";
import { apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import { getHrOverview } from "@/lib/hr-reports";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    const data = await getHrOverview(month);
    return apiSuccess(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

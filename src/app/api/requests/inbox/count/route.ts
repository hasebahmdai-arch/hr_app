import { requireHR } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-utils";
import { fetchAttentionCount } from "@/lib/request-inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireHR();
    const count = await fetchAttentionCount();
    return apiSuccess({ count });
  } catch (error) {
    return handleRouteError(error);
  }
}

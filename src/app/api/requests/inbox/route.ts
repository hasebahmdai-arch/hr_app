import { requireHR } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-utils";
import { fetchInboxRows } from "@/lib/request-inbox";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ATTENTION";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const all = await fetchInboxRows(status);
    const total = all.length;
    const skip = (page - 1) * limit;
    const items = all.slice(skip, skip + limit);

    return apiSuccess({ items, total, page, limit });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { REQUEST_MODELS } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import type { PendingApprovalsResponse } from "@/types/api";

export async function GET() {
  try {
    await requireHR();
    await connectDB();

    const byType: Record<string, number> = {};
    let count = 0;

    for (const [type, Model] of Object.entries(REQUEST_MODELS)) {
      const pending = await Model.countDocuments({ status: "PENDING" });
      const canceling = await Model.countDocuments({ status: "CANCELING" });
      const typeCount = pending + canceling;
      byType[type] = typeCount;
      count += typeCount;
    }

    const response: PendingApprovalsResponse = { count, byType };
    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

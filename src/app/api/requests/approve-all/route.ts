import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { REQUEST_MODELS } from "@/lib/models";
import {
  approveRequestDoc,
  type ApproveRequestFailure,
  type ApproveRequestResult,
} from "@/lib/approve-request";
import { handleRouteError } from "@/lib/route-utils";
import { requestTypeSchema } from "@/lib/validations";
import { REQUEST_TYPES, type RequestType } from "@/lib/constants";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: requestTypeSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireHR();
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    const types: RequestType[] = parsed.data.type
      ? [parsed.data.type]
      : [...REQUEST_TYPES];

    await connectDB();

    const approved: ApproveRequestResult[] = [];
    const failed: ApproveRequestFailure[] = [];

    for (const type of types) {
      const Model = REQUEST_MODELS[type];
      const pending = await Model.find({
        status: { $in: ["PENDING", "CANCELING"] },
      })
        .select("_id requestCode status")
        .lean<{ _id: { toString(): string }; requestCode?: string }[]>();

      for (const row of pending) {
        const id = row._id.toString();
        const requestCode = String(row.requestCode ?? "");
        try {
          const result = await approveRequestDoc(type, id, session.user.id);
          approved.push(result);
        } catch (err) {
          failed.push({
            _id: id,
            type,
            requestCode,
            ok: false,
            error: err instanceof Error ? err.message : "Approve failed",
          });
        }
      }
    }

    return apiSuccess({
      approved: approved.length,
      failed: failed.length,
      results: [...approved, ...failed],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

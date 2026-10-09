import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import connectDB from "@/lib/db";
import { notify } from "@/lib/notifications";
import { REQUEST_MODELS } from "@/lib/models";
import {
  applyRequestEffect,
  isAttendanceRequestType,
  revertRequestEffect,
} from "@/lib/request-effects";
import { handleRouteError } from "@/lib/route-utils";
import { requestActionSchema, requestTypeSchema } from "@/lib/validations";
import type { RequestType } from "@/lib/constants";

export async function PATCH(req: Request, { params }: { params: { type: string; id: string } }) {
  try {
    const session = await requireSession();
    const typeResult = requestTypeSchema.safeParse(params.type);
    if (!typeResult.success) {
      return apiError("Invalid request type", "VALIDATION_ERROR", 400);
    }

    const body = await req.json();
    const parsed = requestActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid action", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const requestType = typeResult.data as RequestType;
    const Model = REQUEST_MODELS[requestType];
    const request = await Model.findById(params.id);
    if (!request) return apiError("Request not found", "NOT_FOUND", 404);

    const doc = request as unknown as {
      _id: { toString(): string };
      employeeId: { toString(): string };
      status: string;
      requestCode: string;
      effectAppliedAt?: Date;
      effectSnapshot?: unknown;
      save(): Promise<unknown>;
      reviewedBy?: unknown;
      reviewedAt?: Date;
      [key: string]: unknown;
    };

    const isOwner = doc.employeeId.toString() === session.user.id;
    const isHR = session.user.role === "hr";
    const previousStatus = doc.status;
    let newStatus: string;

    switch (parsed.data.action) {
      case "approve":
        if (!isHR) return apiError("Forbidden", "FORBIDDEN", 403);
        if (!["PENDING", "CANCELING"].includes(doc.status)) {
          return apiError("Cannot approve request in current status", "INVALID_STATUS", 400);
        }
        newStatus = doc.status === "CANCELING" ? "CANCELLED" : "COMPLETED";
        break;
      case "reject":
        if (!isHR) return apiError("Forbidden", "FORBIDDEN", 403);
        if (doc.status !== "PENDING") {
          return apiError("Cannot reject request in current status", "INVALID_STATUS", 400);
        }
        newStatus = "REJECTED";
        break;
      case "request_cancel":
        if (!isOwner) return apiError("Forbidden", "FORBIDDEN", 403);
        if (doc.status !== "PENDING") {
          return apiError("Cannot cancel request in current status", "INVALID_STATUS", 400);
        }
        newStatus = "CANCELING";
        break;
      case "cancel":
        if (!isOwner && !isHR) return apiError("Forbidden", "FORBIDDEN", 403);
        if (!["PENDING", "CANCELING"].includes(doc.status)) {
          return apiError("Cannot cancel request in current status", "INVALID_STATUS", 400);
        }
        newStatus = "CANCELLED";
        break;
      default:
        return apiError("Invalid action", "VALIDATION_ERROR", 400);
    }

    if (parsed.data.action === "approve") {
      try {
        if (previousStatus === "PENDING" && !doc.effectAppliedAt && isAttendanceRequestType(requestType)) {
          const snapshot = await applyRequestEffect(requestType, doc);
          if (snapshot) {
            doc.effectSnapshot = snapshot;
            doc.effectAppliedAt = new Date();
          }
        } else if (previousStatus === "CANCELING" && doc.effectAppliedAt) {
          await revertRequestEffect(requestType, doc);
          doc.effectSnapshot = undefined;
          doc.effectAppliedAt = undefined;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply timesheet changes";
        return apiError(message, "TIMESHEET_APPLY_FAILED", 400);
      }
    }

    doc.status = newStatus;
    if (["approve", "reject"].includes(parsed.data.action)) {
      doc.reviewedBy = session.user.id;
      doc.reviewedAt = new Date();
    }
    await doc.save();

    await writeAuditLog({
      entityType: `${requestType}_request`,
      entityId: doc._id.toString(),
      actorId: session.user.id,
      action: parsed.data.action,
      previousStatus,
      newStatus,
    });

    if (parsed.data.action === "approve" || parsed.data.action === "reject") {
      const approved = parsed.data.action === "approve";
      await notify({
        type: `${requestType.toUpperCase().replace(/-/g, "_")}_STATUS`,
        title: `Request ${approved ? "approved" : "rejected"}`,
        body: `Your ${requestType.replace(/-/g, " ")} request ${doc.requestCode} has been ${approved ? "approved" : "rejected"}.${
          parsed.data.reason ? `\n\nNote from HR: ${parsed.data.reason}` : ""
        }\n\nYou can view the request details in the portal.`,
        recipientId: doc.employeeId.toString(),
        href: `/app/requests/${requestType}?status=${newStatus}`,
        ctaLabel: "View request",
        forceEmail: true,
      });
    } else if (parsed.data.action === "request_cancel") {
      await notify({
        type: `${requestType.toUpperCase().replace(/-/g, "_")}_CANCEL`,
        title: "Cancellation requested",
        body: `An employee requested cancellation of ${requestType.replace(/-/g, " ")} request ${doc.requestCode}.\n\nPlease review and approve or reject the cancellation.`,
        hrBroadcast: true,
        forceEmail: true,
        href: `/app/requests/${requestType}?status=CANCELING`,
        ctaLabel: "Review cancellation",
      });
    }

    return apiSuccess({
      _id: doc._id.toString(),
      status: newStatus,
      reviewedBy: session.user.id,
      reviewedAt: doc.reviewedAt?.toISOString(),
      effectAppliedAt: doc.effectAppliedAt?.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

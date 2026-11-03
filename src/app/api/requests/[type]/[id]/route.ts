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
import { assertCanTake, assertCanTakeWfh, countLeaveDays } from "@/lib/leave-balance";
import { processLeaveDeductionsForEmployee, revertLeaveDeductions } from "@/lib/leave-deduct";
import { processWfhDeductionsForEmployee, revertWfhDeductions } from "@/lib/wfh-deduct";
import { handleRouteError } from "@/lib/route-utils";
import { createRequestBodySchema, requestActionSchema, requestTypeSchema } from "@/lib/validations";
import type { RequestType } from "@/lib/constants";

export const dynamic = "force-dynamic";


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

    if (parsed.data.action === "update") {
      if (!isOwner) return apiError("Forbidden", "FORBIDDEN", 403);
      if (doc.status !== "PENDING") {
        return apiError("Only PENDING requests can be edited", "INVALID_STATUS", 400);
      }
      const fields = parsed.data.fields ?? {};
      const schema = createRequestBodySchema(requestType);
      const fieldParsed = schema.safeParse(fields);
      if (!fieldParsed.success) {
        return apiError("Invalid request data", "VALIDATION_ERROR", 400, fieldParsed.error.issues);
      }
      const data = fieldParsed.data as Record<string, unknown>;
      try {
        if (requestType === "leave") {
          const start = new Date(data.startDate as string);
          const end = new Date(data.endDate as string);
          const { days } = await assertCanTake(
            session.user.id,
            String(data.leaveType ?? ""),
            start,
            end,
            doc._id.toString()
          );
          doc.leaveType = data.leaveType;
          doc.startDate = start;
          doc.endDate = end;
          doc.daysRequested = days;
          doc.reason = data.reason;
        } else if (requestType === "reimbursement") {
          doc.amount = data.amount;
          doc.reason = data.reason;
          doc.expenseDate = new Date(data.expenseDate as string);
          if (data.receiptFileIds) doc.receiptFileIds = data.receiptFileIds;
        } else if (requestType === "loans") {
          doc.salaryCount = data.salaryCount;
          doc.purpose = data.purpose;
          doc.repaymentPlan = data.repaymentPlan;
          doc.reason = data.reason;
        } else if (requestType === "wfh") {
          const dates = (data.dates as string[]).map((d) => new Date(d));
          const { days } = await assertCanTakeWfh(session.user.id, dates, doc._id.toString());
          doc.dates = dates;
          doc.daysRequested = days;
          doc.daysDeductedSoFar = 0;
          doc.deductedDates = [];
          doc.reason = data.reason;
        } else if (requestType === "punch") {
          doc.punchType = data.punchType;
          doc.requestedTimestamp = new Date(data.requestedTimestamp as string);
          doc.reason = data.reason;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        return apiError(message, "VALIDATION_ERROR", 400);
      }
      await doc.save();
      await writeAuditLog({
        entityType: `${requestType}_request`,
        entityId: doc._id.toString(),
        actorId: session.user.id,
        action: "update",
        previousStatus,
        newStatus: previousStatus,
      });
      return apiSuccess({ _id: doc._id.toString(), status: doc.status });
    }

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
        if (doc.status === "PENDING") {
          newStatus = "CANCELING";
        } else if (
          doc.status === "COMPLETED" &&
          isAttendanceRequestType(requestType)
        ) {
          newStatus = "CANCELING";
        } else {
          return apiError("Cannot cancel request in current status", "INVALID_STATUS", 400);
        }
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
          if (requestType === "leave") {
            const start = new Date(doc.startDate as Date);
            const end = new Date(doc.endDate as Date);
            const { days } = await assertCanTake(
              doc.employeeId.toString(),
              String(doc.leaveType ?? ""),
              start,
              end,
              doc._id.toString()
            );
            doc.daysRequested = days || countLeaveDays(start, end);
            doc.daysDeductedSoFar = 0;
            doc.deductedDates = [];
            doc.effectAppliedAt = new Date();
            doc.effectSnapshot = { dates: [] };
          } else if (requestType === "wfh") {
            const dates = ((doc.dates as Date[]) ?? []).map((d) => new Date(d));
            const { days } = await assertCanTakeWfh(
              doc.employeeId.toString(),
              dates,
              doc._id.toString()
            );
            doc.daysRequested = days;
            doc.daysDeductedSoFar = 0;
            doc.deductedDates = [];
            doc.effectAppliedAt = new Date();
            doc.effectSnapshot = { dates: [] };
          } else {
            const snapshot = await applyRequestEffect(requestType, doc);
            if (snapshot) {
              doc.effectSnapshot = snapshot;
              doc.effectAppliedAt = new Date();
            }
          }
        } else if (previousStatus === "CANCELING" && doc.effectAppliedAt) {
          if (requestType === "leave") {
            await revertLeaveDeductions(doc as never);
            doc.daysDeductedSoFar = 0;
            doc.deductedDates = [];
          } else if (requestType === "wfh") {
            await revertWfhDeductions(doc as never);
            doc.daysDeductedSoFar = 0;
            doc.deductedDates = [];
          } else {
            await revertRequestEffect(requestType, doc);
          }
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

    if (
      parsed.data.action === "approve" &&
      previousStatus === "PENDING" &&
      newStatus === "COMPLETED"
    ) {
      if (requestType === "leave") {
        await processLeaveDeductionsForEmployee(doc.employeeId.toString());
      } else if (requestType === "wfh") {
        await processWfhDeductionsForEmployee(doc.employeeId.toString());
      }
    }

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

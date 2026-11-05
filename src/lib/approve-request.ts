import { writeAuditLog } from "@/lib/audit";
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
import type { RequestType } from "@/lib/constants";

export type ApproveRequestResult = {
  _id: string;
  type: RequestType;
  requestCode: string;
  status: string;
  ok: true;
};

export type ApproveRequestFailure = {
  _id: string;
  type: RequestType;
  requestCode?: string;
  ok: false;
  error: string;
};

type RequestDoc = {
  _id: { toString(): string };
  employeeId: { toString(): string };
  status: string;
  requestCode: string;
  effectAppliedAt?: Date;
  effectSnapshot?: unknown;
  reviewedBy?: unknown;
  reviewedAt?: Date;
  save(): Promise<unknown>;
  [key: string]: unknown;
};

/** Approve one PENDING or CANCELING request (same side effects as single PATCH approve). */
export async function approveRequestDoc(
  requestType: RequestType,
  id: string,
  reviewerId: string
): Promise<ApproveRequestResult> {
  const Model = REQUEST_MODELS[requestType];
  const request = await Model.findById(id);
  if (!request) throw new Error("Request not found");

  const doc = request as unknown as RequestDoc;
  const previousStatus = doc.status;

  if (!["PENDING", "CANCELING"].includes(doc.status)) {
    throw new Error("Cannot approve request in current status");
  }

  const newStatus = doc.status === "CANCELING" ? "CANCELLED" : "COMPLETED";

  if (previousStatus === "PENDING" && !doc.effectAppliedAt && isAttendanceRequestType(requestType)) {
    if (requestType === "leave") {
      const start = new Date(doc.startDate as Date);
      const end = new Date(doc.endDate as Date);
      const { days } = await assertCanTake(String(doc.leaveType ?? ""), start, end);
      doc.daysRequested = days || countLeaveDays(start, end);
      doc.daysDeductedSoFar = 0;
      doc.deductedDates = [];
      doc.effectAppliedAt = new Date();
      doc.effectSnapshot = { dates: [] };
    } else if (requestType === "wfh") {
      const dates = ((doc.dates as Date[]) ?? []).map((d) => new Date(d));
      const { days } = await assertCanTakeWfh(dates);
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

  doc.status = newStatus;
  doc.reviewedBy = reviewerId;
  doc.reviewedAt = new Date();
  await doc.save();

  if (previousStatus === "PENDING" && newStatus === "COMPLETED") {
    if (requestType === "leave") {
      await processLeaveDeductionsForEmployee(doc.employeeId.toString());
    } else if (requestType === "wfh") {
      await processWfhDeductionsForEmployee(doc.employeeId.toString());
    }
  }

  await writeAuditLog({
    entityType: `${requestType}_request`,
    entityId: doc._id.toString(),
    actorId: reviewerId,
    action: "approve",
    previousStatus,
    newStatus,
  });

  await notify({
    type: `${requestType.toUpperCase().replace(/-/g, "_")}_STATUS`,
    title: "Request approved",
    body: `Your ${requestType.replace(/-/g, " ")} request ${doc.requestCode} has been approved.\n\nYou can view the request details in the portal.`,
    recipientId: doc.employeeId.toString(),
    href: `/app/requests/${requestType}?status=${newStatus}`,
    ctaLabel: "View request",
    forceEmail: true,
  });

  return {
    _id: doc._id.toString(),
    type: requestType,
    requestCode: doc.requestCode,
    status: newStatus,
    ok: true,
  };
}

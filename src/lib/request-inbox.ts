import { format } from "date-fns";
import { REQUEST_TYPES } from "@/lib/constants";
import connectDB from "@/lib/db";
import { REQUEST_MODELS } from "@/lib/models";

export interface InboxRow {
  _id: string;
  requestCode: string;
  type: string;
  status: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
  reason?: string;
  summary?: string;
}

function buildSummary(type: string, row: Record<string, unknown>): string | undefined {
  if (type === "leave") {
    const leaveType = row.leaveType ? String(row.leaveType) : "Leave";
    const start = row.startDate ? format(new Date(row.startDate as Date), "MMM d") : "";
    const end = row.endDate ? format(new Date(row.endDate as Date), "MMM d") : "";
    return [leaveType, start && end ? `${start}–${end}` : start || end].filter(Boolean).join(" · ");
  }
  if (type === "wfh") {
    const dates = (row.dates as Date[] | undefined) ?? [];
    if (!dates.length) return "WFH";
    const labels = dates
      .slice(0, 3)
      .map((d) => format(new Date(d), "MMM d"))
      .join(", ");
    return dates.length > 3 ? `${labels} (+${dates.length - 3})` : labels;
  }
  if (type === "reimbursement") {
    const amount = row.amount != null ? `PKR ${Number(row.amount).toLocaleString()}` : "";
    const expenseDate = row.expenseDate
      ? format(new Date(row.expenseDate as Date), "MMM d, yyyy h:mm a")
      : "";
    return [amount, expenseDate].filter(Boolean).join(" · ") || undefined;
  }
  if (type === "punch") {
    const punchType = String(row.punchType ?? "punch").replace(/_/g, " ");
    const at = row.requestedTimestamp
      ? format(new Date(row.requestedTimestamp as Date), "MMM d, h:mm a")
      : "";
    return [punchType, at].filter(Boolean).join(" · ");
  }
  if (type === "loans") {
    const count = row.salaryCount != null ? `${row.salaryCount} salary` : "";
    return count || undefined;
  }
  return undefined;
}

export async function fetchInboxRows(statusFilter?: string): Promise<InboxRow[]> {
  await connectDB();
  const rows: InboxRow[] = [];

  for (const type of REQUEST_TYPES) {
    const Model = REQUEST_MODELS[type];
    const filter: Record<string, unknown> = {};
    if (statusFilter === "ATTENTION" || statusFilter === "PENDING") {
      filter.status = { $in: ["PENDING", "CANCELING"] };
    } else if (statusFilter === "CANCELING") {
      filter.status = "CANCELING";
    } else if (statusFilter && statusFilter !== "ALL") {
      filter.status = statusFilter;
    }

    const items = await Model.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("employeeId", "firstName lastName")
      .lean();

    for (const item of items) {
      const row = item as Record<string, unknown>;
      const emp = row.employeeId as {
        _id?: { toString(): string };
        firstName?: string;
        lastName?: string;
      } | null;
      const reason =
        typeof row.reason === "string" && row.reason.trim()
          ? row.reason.trim()
          : typeof row.purpose === "string" && row.purpose.trim()
            ? row.purpose.trim()
            : undefined;
      rows.push({
        _id: (row._id as { toString(): string }).toString(),
        requestCode: row.requestCode as string,
        type,
        status: row.status as string,
        employeeId: emp?._id?.toString?.() ?? String(row.employeeId),
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        createdAt: (row.createdAt as Date).toISOString(),
        reason,
        summary: buildSummary(type, row),
      });
    }
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows;
}

export async function fetchAttentionCount(): Promise<number> {
  await connectDB();
  let count = 0;
  for (const type of REQUEST_TYPES) {
    const Model = REQUEST_MODELS[type];
    count += await Model.countDocuments({ status: { $in: ["PENDING", "CANCELING"] } });
  }
  return count;
}

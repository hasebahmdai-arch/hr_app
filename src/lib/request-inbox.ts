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
}

export async function fetchInboxRows(statusFilter?: string): Promise<InboxRow[]> {
  await connectDB();
  const rows: InboxRow[] = [];

  for (const type of REQUEST_TYPES) {
    const Model = REQUEST_MODELS[type];
    const filter: Record<string, unknown> = {};
    if (statusFilter === "ATTENTION") {
      filter.status = { $in: ["PENDING", "CANCELING"] };
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
      const emp = row.employeeId as { _id?: { toString(): string }; firstName?: string; lastName?: string } | null;
      rows.push({
        _id: (row._id as { toString(): string }).toString(),
        requestCode: row.requestCode as string,
        type,
        status: row.status as string,
        employeeId: emp?._id?.toString?.() ?? String(row.employeeId),
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        createdAt: (row.createdAt as Date).toISOString(),
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

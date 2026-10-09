import connectDB from "@/lib/db";
import { AuditLog } from "@/lib/models";

export async function writeAuditLog(params: {
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
}) {
  await connectDB();
  await AuditLog.create({ ...params, timestamp: new Date() });
}

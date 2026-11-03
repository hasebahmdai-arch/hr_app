import connectDB from "@/lib/db";
import { deleteFromGridFS, type GridFSBucketName } from "@/lib/gridfs";
import { CompanyDocument, FileMetadata } from "@/lib/models";
import type { UserRole } from "@/types/domain";
import mongoose from "mongoose";

export async function canAccessFile(
  fileId: string,
  userId: string,
  role: UserRole,
  employeeId?: string
) {
  await connectDB();
  const file = await FileMetadata.findById(fileId);
  if (!file) return { allowed: false, file: null };

  if (role === "hr") return { allowed: true, file };
  if (file.bucket === "announcements") return { allowed: true, file };
  // Avatars are visible to all logged-in users (e.g. birthday/anniversary cards)
  if (file.bucket === "avatars") return { allowed: true, file };

  // Documents: personal (subject employee) or company-wide shared docs
  if (file.bucket === "documents") {
    const subjectId = file.employeeId?.toString();
    if (subjectId && (subjectId === userId || subjectId === employeeId)) {
      return { allowed: true, file };
    }
    const isCompanyDoc = await CompanyDocument.exists({
      $or: [{ fileId }, { thumbnailFileId: fileId }],
    });
    if (isCompanyDoc) return { allowed: true, file };
    return { allowed: false, file };
  }

  if (file.uploadedBy?.toString() === userId) return { allowed: true, file };
  if (file.employeeId?.toString() === userId) return { allowed: true, file };
  if (employeeId && file.employeeId?.toString() === employeeId) return { allowed: true, file };

  return { allowed: false, file };
}

export async function deleteFileMetadata(fileId: string) {
  await connectDB();
  const file = await FileMetadata.findById(fileId);
  if (!file) return;
  await deleteFromGridFS(file.bucket as GridFSBucketName, file.gridFsId as mongoose.Types.ObjectId);
  await FileMetadata.findByIdAndDelete(fileId);
}

/** Best-effort delete; ignores missing/invalid ids and GridFS errors. */
export async function safeDeleteFile(fileId?: string | null) {
  if (!fileId) return;
  try {
    await deleteFileMetadata(fileId);
  } catch {
    // continue even if GridFS or metadata is already gone
  }
}

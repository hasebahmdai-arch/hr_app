import { Readable } from "stream";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { canAccessFile, deleteFileMetadata } from "@/lib/files";
import { downloadFromGridFS, type GridFSBucketName } from "@/lib/gridfs";
import { handleRouteError } from "@/lib/route-utils";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const { allowed, file } = await canAccessFile(params.id, session.user.id, session.user.role);
    if (!file) return apiError("File not found", "NOT_FOUND", 404);
    if (!allowed) return apiError("Forbidden", "FORBIDDEN", 403);

    const stream = await downloadFromGridFS(file.bucket as GridFSBucketName, file.gridFsId);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${file.filename || "file"}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const { file } = await canAccessFile(params.id, session.user.id, session.user.role);
    if (!file) return apiError("File not found", "NOT_FOUND", 404);

    const isHR = session.user.role === "hr";
    // Documents (and announcements) may only be removed by HR
    if (file.bucket === "documents" || file.bucket === "announcements") {
      if (!isHR) return apiError("Forbidden", "FORBIDDEN", 403);
    } else {
      const isOwner = file.uploadedBy?.toString() === session.user.id;
      if (!isOwner && !isHR) return apiError("Forbidden", "FORBIDDEN", 403);
    }

    await deleteFileMetadata(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}

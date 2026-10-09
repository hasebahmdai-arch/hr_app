import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { uploadToGridFS, type GridFSBucketName } from "@/lib/gridfs";
import { FileMetadata } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { gridFSBucketSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const formData = await req.formData();
    const file = formData.get("file");
    const bucketRaw = formData.get("bucket");
    const entityType = formData.get("entityType")?.toString();
    const entityId = formData.get("entityId")?.toString();
    const employeeId = formData.get("employeeId")?.toString();

    if (!(file instanceof File)) {
      return apiError("File is required", "VALIDATION_ERROR", 400);
    }

    const bucketResult = gridFSBucketSchema.safeParse(bucketRaw);
    if (!bucketResult.success) {
      return apiError("Invalid bucket", "VALIDATION_ERROR", 400, bucketResult.error.issues);
    }

    const bucket = bucketResult.data as GridFSBucketName;
    // Employee documents are HR-managed only
    if (bucket === "documents" && session.user.role !== "hr") {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }
    if (bucket === "announcements" && session.user.role !== "hr") {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const gridFsId = await uploadToGridFS(bucket, buffer, file.name, {
      uploadedBy: session.user.id,
    });

    await connectDB();
    const metadata = await FileMetadata.create({
      gridFsId,
      bucket,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      uploadedBy: session.user.id,
      employeeId: employeeId || session.user.id,
      entityType,
      entityId,
    });

    return apiSuccess({
      _id: metadata._id.toString(),
      gridFsId: gridFsId.toString(),
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

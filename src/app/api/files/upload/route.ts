import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { uploadToGridFS, type GridFSBucketName } from "@/lib/gridfs";
import { FileMetadata } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { gridFSBucketSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";


const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const DOC_EXT = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);

const RECEIPT_MIME = new Set<string>(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const RECEIPT_EXT = new Set<string>([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);

function fileExtension(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function assertAllowedMime(bucket: GridFSBucketName, file: File) {
  const mime = (file.type || "").toLowerCase();
  const ext = fileExtension(file.name);

  if (bucket === "avatars" || bucket === "announcements") {
    if (IMAGE_MIME.has(mime) || IMAGE_EXT.has(ext)) return;
    throw Object.assign(new Error("Only image files are allowed (jpeg, png, webp, gif)"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }
  if (bucket === "documents") {
    if (DOC_MIME.has(mime) || DOC_EXT.has(ext)) return;
    throw Object.assign(new Error("Only PDF, Word, or PowerPoint files are allowed"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }
  if (bucket === "receipts") {
    if (RECEIPT_MIME.has(mime) || RECEIPT_EXT.has(ext)) return;
    throw Object.assign(new Error("Only images or PDF receipts are allowed"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }
}

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

    try {
      assertAllowedMime(bucket, file);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid file type";
      return apiError(message, "VALIDATION_ERROR", 400);
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

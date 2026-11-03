import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { safeDeleteFile } from "@/lib/files";
import { CompanyDocument } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

const emptyToUndefined = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const companyDocPatchSchema = z.object({
  title: z.string().min(1).optional(),
  fileId: z.string().min(1).optional(),
  thumbnailFileId: emptyToUndefined,
  category: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = companyDocPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid document data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const existing = await CompanyDocument.findById(params.id);
    if (!existing) return apiError("Document not found", "NOT_FOUND", 404);

    const update: Record<string, unknown> = { ...parsed.data };
    const clearingThumb = "thumbnailFileId" in body && !body.thumbnailFileId;
    if (clearingThumb) {
      update.thumbnailFileId = null;
    }

    const prevFileId = existing.fileId?.toString() ?? null;
    const nextFileId =
      parsed.data.fileId !== undefined ? parsed.data.fileId : prevFileId;
    if (prevFileId && prevFileId !== nextFileId) {
      await safeDeleteFile(prevFileId);
    }

    const prevThumbId = existing.thumbnailFileId?.toString() ?? null;
    const nextThumbId = clearingThumb
      ? null
      : parsed.data.thumbnailFileId !== undefined
        ? parsed.data.thumbnailFileId
        : prevThumbId;
    if (prevThumbId && prevThumbId !== nextThumbId) {
      await safeDeleteFile(prevThumbId);
    }

    const doc = await CompanyDocument.findByIdAndUpdate(params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!doc) return apiError("Document not found", "NOT_FOUND", 404);

    return apiSuccess({
      _id: doc._id.toString(),
      title: doc.title,
      fileId: doc.fileId?.toString(),
      thumbnailFileId: doc.thumbnailFileId?.toString(),
      category: doc.category,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const doc = await CompanyDocument.findById(params.id);
    if (!doc) return apiError("Document not found", "NOT_FOUND", 404);

    await safeDeleteFile(doc.fileId?.toString());
    await safeDeleteFile(doc.thumbnailFileId?.toString());
    await CompanyDocument.findByIdAndDelete(params.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

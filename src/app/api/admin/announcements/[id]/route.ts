import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { safeDeleteFile } from "@/lib/files";
import { Announcement } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

const emptyToUndefined = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const announcementPatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  imageFileId: emptyToUndefined,
  type: z.string().optional(),
  publishedAt: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = announcementPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid announcement data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const existing = await Announcement.findById(params.id);
    if (!existing) return apiError("Announcement not found", "NOT_FOUND", 404);

    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.publishedAt) {
      update.publishedAt = new Date(parsed.data.publishedAt);
    }

    const clearingImage = "imageFileId" in body && !body.imageFileId;
    if (clearingImage) {
      update.imageFileId = null;
    }

    const nextImageId = clearingImage
      ? null
      : parsed.data.imageFileId !== undefined
        ? parsed.data.imageFileId
        : existing.imageFileId?.toString();
    const prevImageId = existing.imageFileId?.toString() ?? null;
    if (prevImageId && prevImageId !== nextImageId) {
      await safeDeleteFile(prevImageId);
    }

    const announcement = await Announcement.findByIdAndUpdate(params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!announcement) return apiError("Announcement not found", "NOT_FOUND", 404);

    return apiSuccess({
      _id: announcement._id.toString(),
      title: announcement.title,
      body: announcement.body,
      imageFileId: announcement.imageFileId?.toString(),
      type: announcement.type,
      publishedAt: announcement.publishedAt?.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const announcement = await Announcement.findById(params.id);
    if (!announcement) return apiError("Announcement not found", "NOT_FOUND", 404);

    await safeDeleteFile(announcement.imageFileId?.toString());
    await Announcement.findByIdAndDelete(params.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

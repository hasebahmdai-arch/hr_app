import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Announcement, CompanyDocument } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

const companyDocSchema = z.object({
  title: z.string().min(1),
  fileId: z.string().min(1),
  thumbnailFileId: z.string().optional(),
  category: z.string().optional(),
});

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  imageFileId: z.string().optional(),
  type: z.string().optional(),
  publishedAt: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

    await connectDB();
    const result: Record<string, unknown> = {};

    if (type === "all" || type === "documents") {
      const docs = await CompanyDocument.find().sort({ createdAt: -1 }).lean();
      result.companyDocuments = docs.map((d) => ({
        _id: d._id.toString(),
        title: d.title,
        fileId: d.fileId?.toString(),
        thumbnailFileId: d.thumbnailFileId?.toString(),
        category: d.category,
      }));
    }

    if (type === "all" || type === "announcements") {
      const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
      result.announcements = announcements.map((a) => ({
        _id: a._id.toString(),
        title: a.title,
        body: a.body,
        imageFileId: a.imageFileId?.toString(),
        type: a.type,
        publishedAt: a.publishedAt?.toISOString(),
        createdBy: a.createdBy?.toString(),
      }));
    }

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireHR();
    const body = await req.json();
    const itemType = body.itemType as string;

    await connectDB();

    if (itemType === "document") {
      const parsed = companyDocSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("Invalid document data", "VALIDATION_ERROR", 400, parsed.error.issues);
      }
      const doc = await CompanyDocument.create(parsed.data);
      return apiSuccess({ _id: doc._id.toString(), ...parsed.data }, 201);
    }

    if (itemType === "announcement") {
      const parsed = announcementSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("Invalid announcement data", "VALIDATION_ERROR", 400, parsed.error.issues);
      }
      const announcement = await Announcement.create({
        ...parsed.data,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
        createdBy: session.user.id,
      });
      return apiSuccess({
        _id: announcement._id.toString(),
        title: announcement.title,
        body: announcement.body,
        imageFileId: announcement.imageFileId?.toString(),
        type: announcement.type,
        publishedAt: announcement.publishedAt?.toISOString(),
      }, 201);
    }

    return apiError("itemType must be 'document' or 'announcement'", "VALIDATION_ERROR", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}

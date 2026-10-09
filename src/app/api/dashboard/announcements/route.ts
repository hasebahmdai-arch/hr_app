import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Announcement, CompanyDocument } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import type { AnnouncementsResponse } from "@/types/api";

export async function GET() {
  try {
    await requireSession();
    await connectDB();

    const [companyDocuments, announcements] = await Promise.all([
      CompanyDocument.find().sort({ createdAt: -1 }).limit(20).lean(),
      Announcement.find({ publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(20).lean(),
    ]);

    const response: AnnouncementsResponse = {
      companyDocuments: companyDocuments.map((d) => ({
        _id: d._id.toString(),
        title: d.title || "",
        fileId: d.fileId?.toString() || "",
        category: d.category || "",
      })),
      announcements: announcements.map((a) => ({
        _id: a._id.toString(),
        title: a.title || "",
        body: a.body || "",
        imageFileId: a.imageFileId?.toString(),
        type: a.type || "",
      })),
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

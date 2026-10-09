import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notification } from "@/lib/models";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import { notificationPatchSchema } from "@/lib/validations";
import type { PaginatedResponse } from "@/types/api";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const unreadOnly = searchParams.get("unread") === "true";

    await connectDB();
    const filter: Record<string, unknown> = { userId: session.user.id };
    if (unreadOnly) filter.read = false;

    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    const response: PaginatedResponse<Record<string, unknown>> = {
      items: items.map((n) => ({
        _id: n._id.toString(),
        userId: n.userId?.toString(),
        title: n.title,
        body: n.body,
        type: n.type,
        href: n.href,
        read: n.read,
        createdAt: n.createdAt?.toISOString(),
      })),
      total,
      page,
      limit,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = notificationPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    if (parsed.data.markAllRead) {
      await Notification.updateMany({ userId: session.user.id, read: false }, { $set: { read: true } });
      return apiSuccess({ updated: "all" });
    }

    if (parsed.data.typePrefix) {
      const prefix = parsed.data.typePrefix.toUpperCase();
      const result = await Notification.updateMany(
        { userId: session.user.id, read: false, type: { $regex: `^${prefix}` } },
        { $set: { read: true } }
      );
      return apiSuccess({ updated: result.modifiedCount });
    }

    if (parsed.data.ids?.length) {
      await Notification.updateMany(
        { _id: { $in: parsed.data.ids }, userId: session.user.id },
        { $set: { read: true } }
      );
      return apiSuccess({ updated: parsed.data.ids.length });
    }

    return apiError("Provide ids or markAllRead", "VALIDATION_ERROR", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}

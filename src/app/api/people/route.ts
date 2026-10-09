import { apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee } from "@/lib/models";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import type { PaginatedResponse } from "@/types/api";

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const departmentId = searchParams.get("departmentId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const filter: Record<string, unknown> = {};
    if (!includeInactive) {
      filter.accountActive = true;
    }
    if (departmentId) filter.departmentId = departmentId;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { employeeCode: regex },
        { email: regex },
        { designation: regex },
      ];
    }

    await connectDB();
    const [items, total] = await Promise.all([
      Employee.find(filter)
        .select("firstName lastName employeeCode email designation departmentId shiftId avatarFileId hireDate accountActive role")
        .populate("departmentId", "name")
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Employee.countDocuments(filter),
    ]);

    const response: PaginatedResponse<Record<string, unknown>> = {
      items: items.map((e) => ({
        _id: e._id.toString(),
        firstName: e.firstName,
        lastName: e.lastName,
        employeeCode: e.employeeCode,
        email: e.email,
        designation: e.designation,
        departmentId: e.departmentId,
        shiftId: e.shiftId?.toString(),
        avatarFileId: e.avatarFileId?.toString(),
        hireDate: e.hireDate ? new Date(e.hireDate).toISOString() : undefined,
        accountActive: e.accountActive,
        role: e.role,
        department: e.departmentId && typeof e.departmentId === "object"
          ? { _id: (e.departmentId as { _id: { toString(): string }; name: string })._id.toString(), name: (e.departmentId as { name: string }).name }
          : undefined,
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

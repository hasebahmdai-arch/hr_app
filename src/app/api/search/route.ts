import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { CompanyDocument, Employee, REQUEST_MODELS } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return apiError("Query must be at least 2 characters", "VALIDATION_ERROR", 400);
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    await connectDB();

    const employeeFilter: Record<string, unknown> = {
      accountActive: true,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { employeeCode: regex },
      ],
    };
    if (session.user.role !== "hr") {
      employeeFilter._id = session.user.id;
    }

    const [employees, documents] = await Promise.all([
      Employee.find(employeeFilter).select("firstName lastName employeeCode email designation avatarFileId").limit(10).lean(),
      CompanyDocument.find({ title: regex }).limit(5).lean(),
    ]);

    const requests: Record<string, unknown>[] = [];
    for (const [type, Model] of Object.entries(REQUEST_MODELS)) {
      const filter: Record<string, unknown> = { requestCode: regex };
      if (session.user.role !== "hr") filter.employeeId = session.user.id;
      const items = await Model.find(filter).limit(5).lean();
      for (const item of items) {
        const row = item as Record<string, unknown>;
        requests.push({
          type,
          _id: (row._id as { toString(): string }).toString(),
          requestCode: row.requestCode as string,
          status: row.status as string,
        });
      }
    }

    return apiSuccess({
      employees: employees.map((e) => ({
        _id: e._id.toString(),
        firstName: e.firstName,
        lastName: e.lastName,
        employeeCode: e.employeeCode,
        email: e.email,
        designation: e.designation,
        avatarFileId: e.avatarFileId?.toString(),
      })),
      documents: documents.map((d) => ({
        _id: d._id.toString(),
        title: d.title,
        category: d.category,
        fileId: d.fileId?.toString(),
      })),
      requests,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { apiError, apiSuccess } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import connectDB from "@/lib/db";
import { createEmployee } from "@/lib/employee-utils";
import { Employee } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { bootstrapSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-bootstrap-secret");
    const expected = process.env.BOOTSTRAP_SECRET;
    if (!expected || secret !== expected) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }

    await connectDB();
    const count = await Employee.countDocuments();
    if (count > 0) throw new Error("BOOTSTRAP_DISABLED");

    const body = await req.json();
    const parsed = bootstrapSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    const { employee } = await createEmployee({
      ...parsed.data,
      role: "hr",
    });

    await writeAuditLog({
      entityType: "employee",
      entityId: employee._id.toString(),
      actorId: employee._id.toString(),
      action: "bootstrap_created",
    });

    return apiSuccess({
      employee: {
        _id: employee._id.toString(),
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
      },
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

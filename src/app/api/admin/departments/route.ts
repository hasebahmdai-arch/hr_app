import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { departmentSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireHR();
    await connectDB();
    const departments = await Department.find().sort({ name: 1 }).lean();
    return apiSuccess(
      departments.map((d) => ({
        _id: d._id.toString(),
        name: d.name,
        code: d.code,
        description: d.description,
        isActive: d.isActive,
      }))
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = departmentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid department data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const department = await Department.create(parsed.data);
    return apiSuccess({
      _id: department._id.toString(),
      name: department.name,
      code: department.code,
      description: department.description,
      isActive: department.isActive,
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

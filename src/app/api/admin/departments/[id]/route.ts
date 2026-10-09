import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { departmentSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = departmentSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid department data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const department = await Department.findByIdAndUpdate(params.id, parsed.data, { new: true });
    if (!department) return apiError("Department not found", "NOT_FOUND", 404);

    return apiSuccess({
      _id: department._id.toString(),
      name: department.name,
      code: department.code,
      description: department.description,
      isActive: department.isActive,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const department = await Department.findByIdAndDelete(params.id);
    if (!department) return apiError("Department not found", "NOT_FOUND", 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}

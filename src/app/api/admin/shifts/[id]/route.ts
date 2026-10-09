import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Shift } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { shiftSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = shiftSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid shift data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const shift = await Shift.findByIdAndUpdate(params.id, parsed.data, { new: true });
    if (!shift) return apiError("Shift not found", "NOT_FOUND", 404);

    return apiSuccess({
      _id: shift._id.toString(),
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      timezone: shift.timezone,
      isActive: shift.isActive,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const shift = await Shift.findByIdAndDelete(params.id);
    if (!shift) return apiError("Shift not found", "NOT_FOUND", 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}

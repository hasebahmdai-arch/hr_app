import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Shift } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { shiftSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireHR();
    await connectDB();
    const shifts = await Shift.find().sort({ name: 1 }).lean();
    return apiSuccess(
      shifts.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        timezone: s.timezone,
        isActive: s.isActive,
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
    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid shift data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const shift = await Shift.create(parsed.data);
    return apiSuccess({
      _id: shift._id.toString(),
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      timezone: shift.timezone,
      isActive: shift.isActive,
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

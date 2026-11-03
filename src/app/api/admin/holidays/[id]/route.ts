import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Holiday, Timesheet } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { holidaySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";


export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const body = await req.json();
    const parsed = holidaySchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid holiday data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    if (parsed.data.date) {
      const clash = await Holiday.findOne({ date: parsed.data.date, _id: { $ne: params.id } });
      if (clash) return apiError("A holiday already exists for this date", "CONFLICT", 409);
    }

    const holiday = await Holiday.findByIdAndUpdate(params.id, parsed.data, { new: true });
    if (!holiday) return apiError("Holiday not found", "NOT_FOUND", 404);

    if (holiday.isActive !== false) {
      await Timesheet.updateMany(
        {
          date: holiday.date,
          $or: [{ checkIn: { $ne: null } }, { "sessions.0": { $exists: true } }],
        },
        { $set: { isHolidayWork: true } }
      );
    }

    return apiSuccess({
      _id: holiday._id.toString(),
      date: holiday.date,
      name: holiday.name,
      isActive: holiday.isActive !== false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const holiday = await Holiday.findByIdAndDelete(params.id);
    if (!holiday) return apiError("Holiday not found", "NOT_FOUND", 404);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

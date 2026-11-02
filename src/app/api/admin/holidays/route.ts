import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Holiday, Timesheet } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { holidaySchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireHR();
    await connectDB();
    const holidays = await Holiday.find().sort({ date: 1 }).lean();
    return apiSuccess(
      holidays.map((h) => ({
        _id: h._id.toString(),
        date: h.date,
        name: h.name,
        isActive: h.isActive !== false,
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
    const parsed = holidaySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid holiday data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const existing = await Holiday.findOne({ date: parsed.data.date });
    if (existing) {
      return apiError("A holiday already exists for this date", "CONFLICT", 409);
    }

    const holiday = await Holiday.create({
      date: parsed.data.date,
      name: parsed.data.name,
      isActive: parsed.data.isActive ?? true,
    });

    await Timesheet.updateMany(
      {
        date: holiday.date,
        $or: [{ checkIn: { $ne: null } }, { "sessions.0": { $exists: true } }],
      },
      { $set: { isHolidayWork: true } }
    );

    return apiSuccess(
      {
        _id: holiday._id.toString(),
        date: holiday.date,
        name: holiday.name,
        isActive: holiday.isActive,
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

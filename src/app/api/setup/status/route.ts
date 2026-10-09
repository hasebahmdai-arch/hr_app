import { apiSuccess } from "@/lib/api-response";
import connectDB from "@/lib/db";
import { Employee } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const count = await Employee.countDocuments();
    return apiSuccess({ needsBootstrap: count === 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}

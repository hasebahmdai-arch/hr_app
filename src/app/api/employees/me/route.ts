import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { buildProfileResponse } from "@/lib/employee-utils";
import { handleRouteError } from "@/lib/route-utils";

/** @deprecated Prefer /api/profile — kept as alias; Netlify may route this through [id]. */
export async function GET() {
  try {
    const session = await requireSession();
    const profile = await buildProfileResponse(session.user.id);
    return apiSuccess(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH() {
  return apiError("Only HR can edit user profiles", "FORBIDDEN", 403);
}

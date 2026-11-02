import { apiError, apiSuccess } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { requireHR, requireSession } from "@/lib/auth";
import {
  buildProfileResponse,
  hardDeleteEmployee,
  serializeEmployee,
  updateEmployeeProfile,
} from "@/lib/employee-utils";
import { handleRouteError } from "@/lib/route-utils";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const employeeId = params.id === "me" ? session.user.id : params.id;

    // Own profile: any authenticated user. Others: HR only.
    if (employeeId !== session.user.id && session.user.role !== "hr") {
      throw new Error("FORBIDDEN");
    }

    const profile = await buildProfileResponse(employeeId);
    return apiSuccess(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (params.id === "me") {
      return apiError("Only HR can edit user profiles", "FORBIDDEN", 403);
    }
    const session = await requireHR();
    const body = await req.json();
    const employee = await updateEmployeeProfile(params.id, body, session.user.id);
    return apiSuccess(serializeEmployee(employee.toObject()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (params.id === "me") {
      return apiError("Cannot delete via /me", "FORBIDDEN", 403);
    }
    const session = await requireHR();
    await hardDeleteEmployee(params.id, session.user.id);
    await writeAuditLog({
      entityType: "employee",
      entityId: params.id,
      actorId: session.user.id,
      action: "deleted",
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { apiSuccess } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { requireHR } from "@/lib/auth";
import {
  buildProfileResponse,
  hardDeleteEmployee,
  serializeEmployee,
  updateEmployeeProfile,
} from "@/lib/employee-utils";
import { handleRouteError } from "@/lib/route-utils";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const profile = await buildProfileResponse(params.id);
    return apiSuccess(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
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

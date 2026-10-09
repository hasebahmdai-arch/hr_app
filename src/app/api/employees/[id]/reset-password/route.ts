import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Employee } from "@/lib/models";
import { issuePasswordInviteEmail } from "@/lib/password-invite";
import { handleRouteError } from "@/lib/route-utils";

/** Resend set-password invite — HR does not set passwords. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    await connectDB();
    const employee = await Employee.findById(params.id);
    if (!employee) return apiError("Employee not found", "NOT_FOUND", 404);
    if (!employee.accountActive) {
      return apiError("Cannot invite an inactive account", "VALIDATION_ERROR", 400);
    }

    await issuePasswordInviteEmail({
      employeeId: employee._id.toString(),
      email: employee.email,
      firstName: employee.firstName,
      kind: "invite",
    });

    return apiSuccess({ message: "Invite email sent" });
  } catch (error) {
    return handleRouteError(error);
  }
}

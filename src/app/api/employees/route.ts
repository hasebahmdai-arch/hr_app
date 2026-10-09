import { apiError, apiSuccess } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { requireHR } from "@/lib/auth";
import { createEmployee, serializeEmployee } from "@/lib/employee-utils";
import { notify } from "@/lib/notifications";
import { issuePasswordInviteEmail } from "@/lib/password-invite";
import { handleRouteError } from "@/lib/route-utils";
import { createEmployeeSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const session = await requireHR();
    const body = await req.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    // HR never sets passwords — always invite
    const { employee, needsInvite } = await createEmployee({
      ...parsed.data,
      password: undefined,
    });

    await writeAuditLog({
      entityType: "employee",
      entityId: employee._id.toString(),
      actorId: session.user.id,
      action: "created",
    });

    if (needsInvite) {
      await issuePasswordInviteEmail({
        employeeId: employee._id.toString(),
        email: employee.email,
        firstName: employee.firstName,
        kind: "invite",
      });
    }

    // In-app only — welcome + set-password are already in the single invite email
    await notify({
      type: "SYSTEM",
      title: "Welcome to Analytico HRMS",
      body: "Your account has been created. Check your email for a link to set your password, then sign in.",
      recipientId: employee._id.toString(),
      href: "/login",
      skipEmail: true,
    });

    return apiSuccess(
      {
        employee: serializeEmployee(employee.toObject()),
        inviteSent: needsInvite,
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

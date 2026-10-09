import { apiError, apiSuccess } from "@/lib/api-response";
import connectDB from "@/lib/db";
import { Employee } from "@/lib/models";
import { issuePasswordInviteEmail } from "@/lib/password-invite";
import { handleRouteError } from "@/lib/route-utils";
import { forgotPasswordSchema } from "@/lib/validations";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid email", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const employee = await Employee.findOne({ email: parsed.data.email, accountActive: true });
    if (!employee) {
      return apiSuccess({ message: "If the email exists, a reset link has been sent." });
    }

    await issuePasswordInviteEmail({
      employeeId: employee._id.toString(),
      email: employee.email,
      firstName: employee.firstName,
      kind: "reset",
    });

    return apiSuccess({ message: "If the email exists, a reset link has been sent." });
  } catch (error) {
    return handleRouteError(error);
  }
}

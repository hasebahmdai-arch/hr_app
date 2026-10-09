import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { apiError, apiSuccess } from "@/lib/api-response";
import connectDB from "@/lib/db";
import { Employee, PasswordResetToken } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

    await connectDB();
    const resetToken = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!resetToken) {
      return apiError("Invalid or expired token", "INVALID_TOKEN", 400);
    }

    const employee = await Employee.findById(resetToken.employeeId);
    if (!employee) {
      return apiError("Employee not found", "NOT_FOUND", 404);
    }

    employee.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await employee.save();

    resetToken.usedAt = new Date();
    await resetToken.save();

    return apiSuccess({ message: "Password reset successfully" });
  } catch (error) {
    return handleRouteError(error);
  }
}

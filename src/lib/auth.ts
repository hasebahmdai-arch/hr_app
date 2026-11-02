import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { Employee } from "@/lib/models";
import { authConfig } from "@/lib/auth.config";
import { resolveSessionEmployeeId } from "@/lib/employee-utils";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectDB();
        const employee = await Employee.findOne({
          email: credentials.email,
          accountActive: true,
        });
        if (!employee) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          employee.passwordHash
        );
        if (!valid) return null;
        return {
          id: employee._id.toString(),
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          role: employee.role,
        };
      },
    }),
  ],
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  // Heal stale JWT ids (e.g. after DB reseed) via email fallback
  const employeeId = await resolveSessionEmployeeId({
    id: session.user.id,
    email: session.user.email,
  });
  session.user.id = employeeId;

  return session;
}

export async function requireHR() {
  const session = await requireSession();
  if (session.user.role !== "hr") throw new Error("FORBIDDEN");
  return session;
}

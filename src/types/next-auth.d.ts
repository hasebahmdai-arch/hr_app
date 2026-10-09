import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "hr";
    } & DefaultSession["user"];
  }

  interface User {
    role: "employee" | "hr";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "employee" | "hr";
  }
}

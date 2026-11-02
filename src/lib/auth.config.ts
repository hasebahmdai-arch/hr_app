import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;

      if (path.startsWith("/app") && !isLoggedIn) return false;
      if (path.startsWith("/app/admin") && role !== "hr") {
        return Response.redirect(new URL("/app/dashboard", request.nextUrl));
      }
      if (path.startsWith("/app/people") && role !== "hr") {
        return Response.redirect(new URL("/app/dashboard", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const uid = user.id ?? token.sub;
        token.role = (user as { role?: string }).role;
        token.id = uid;
        if (uid) token.sub = uid;
      }
      if (!token.id && token.sub) token.id = token.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const uid = (token.id ?? token.sub) as string | undefined;
        if (uid) session.user.id = uid;
        session.user.role = token.role as "employee" | "hr";
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

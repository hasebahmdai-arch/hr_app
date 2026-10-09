import { createHash, randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";
import { PasswordResetToken } from "@/lib/models";

export function appBaseUrl() {
  return process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
}

function emailShell(title: string, bodyHtml: string) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <div style="padding: 20px 0; border-bottom: 3px solid #F97316;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #F97316;">Analytico HRMS</p>
    </div>
    <div style="padding: 24px 0;">
      <h1 style="margin: 0 0 16px; font-size: 20px;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #737373;">
      <p style="margin: 0;">This message was sent by Analytico HRMS. If you did not expect it, you can ignore this email.</p>
    </div>
  </div>`;
}

function ctaButton(href: string, label: string) {
  return `<p style="margin: 24px 0;">
    <a href="${href}" style="display: inline-block; background: #F97316; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">${label}</a>
  </p>
  <p style="font-size: 13px; color: #737373;">Or open this link:<br/><a href="${href}" style="color: #EA580C; word-break: break-all;">${href}</a></p>`;
}

/** Issue a one-hour set/reset password token and email the link (single combined welcome + set-password for invites). */
export async function issuePasswordInviteEmail(params: {
  employeeId: string;
  email: string;
  firstName: string;
  kind?: "invite" | "reset";
}) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await PasswordResetToken.deleteMany({ employeeId: params.employeeId });
  await PasswordResetToken.create({
    employeeId: params.employeeId,
    tokenHash,
    expiresAt,
  });

  const base = appBaseUrl();
  const resetUrl = `${base}/reset-password?token=${token}`;
  const loginUrl = `${base}/login`;
  const isInvite = (params.kind ?? "invite") === "invite";

  if (isInvite) {
    await sendEmail({
      to: params.email,
      subject: "Welcome to Analytico HRMS — set your password",
      html: emailShell(
        `Welcome, ${params.firstName}!`,
        `<p>Your Analytico HRMS account has been created. Use the button below to set your password and activate access.</p>
         <p>After that, you can sign in to view your dashboard, attendance, and requests.</p>
         ${ctaButton(resetUrl, "Set your password")}
         <p>This link expires in <strong>1 hour</strong>. If it expires, ask HR to resend your invite, or use <a href="${base}/forgot-password">Forgot password</a> once your account is active.</p>
         <p>Sign-in page: <a href="${loginUrl}">${loginUrl}</a></p>`
      ),
      type: "WELCOME_INVITE",
    });
  } else {
    await sendEmail({
      to: params.email,
      subject: "Reset your Analytico HRMS password",
      html: emailShell(
        "Password reset",
        `<p>Hi ${params.firstName},</p>
         <p>We received a request to reset your Analytico HRMS password. Click below to choose a new password.</p>
         ${ctaButton(resetUrl, "Reset password")}
         <p>This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
         <p>Sign in: <a href="${loginUrl}">${loginUrl}</a></p>`
      ),
      type: "PASSWORD_RESET",
    });
  }

  return { resetUrl };
}

export function buildNotificationEmailHtml(params: {
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
}) {
  const base = appBaseUrl();
  const absoluteHref = params.href
    ? params.href.startsWith("http")
      ? params.href
      : `${base}${params.href.startsWith("/") ? "" : "/"}${params.href}`
    : undefined;

  const linkBlock = absoluteHref
    ? ctaButton(absoluteHref, params.ctaLabel || "Open in Analytico HRMS")
    : `<p style="margin-top: 24px;"><a href="${base}/login" style="color: #EA580C;">Sign in to Analytico HRMS</a></p>`;

  return emailShell(
    params.title,
    `<p style="line-height: 1.5; white-space: pre-wrap;">${params.body}</p>${linkBlock}`
  );
}

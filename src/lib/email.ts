import { Resend } from "resend";
import connectDB from "@/lib/db";
import { EmailLog } from "@/lib/models";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Strip env wrapping quotes so Resend accepts `Name <email@domain>` or bare email. */
export function normalizeEmailFrom(raw: string): string {
  let value = raw.trim();
  while (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

const FROM_BARE_EMAIL = /^[^\s<>]+@[^\s<>]+$/;
const FROM_NAME_EMAIL = /^.+\s<[^\s<>]+@[^\s<>]+>$/;

function isValidEmailFrom(from: string): boolean {
  return FROM_BARE_EMAIL.test(from) || FROM_NAME_EMAIL.test(from);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  type: string;
}) {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== "true" || !resend) {
    return false;
  }
  const from = normalizeEmailFrom(process.env.EMAIL_FROM ?? "");
  if (!from) {
    console.error("EMAIL_FROM is required when ENABLE_EMAIL_NOTIFICATIONS is true");
    return false;
  }
  if (!isValidEmailFrom(from)) {
    console.error(
      'EMAIL_FROM is invalid. Use email@domain.com or Name <email@domain.com> (no surrounding quotes). Got:',
      JSON.stringify(from)
    );
    return false;
  }
  try {
    await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    await connectDB();
    await EmailLog.create({
      recipientEmail: params.to,
      type: params.type,
      subject: params.subject,
      status: "sent",
      sentAt: new Date(),
    });
    return true;
  } catch (error) {
    await connectDB();
    await EmailLog.create({
      recipientEmail: params.to,
      type: params.type,
      subject: params.subject,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      sentAt: new Date(),
    });
    return false;
  }
}

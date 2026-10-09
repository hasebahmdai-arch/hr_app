import { Resend } from "resend";
import connectDB from "@/lib/db";
import { EmailLog } from "@/lib/models";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  type: string;
}) {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== "true" || !resend) {
    return false;
  }
  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.error("EMAIL_FROM is required when ENABLE_EMAIL_NOTIFICATIONS is true");
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

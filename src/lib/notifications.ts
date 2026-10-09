import { sendEmail } from "@/lib/email";
import connectDB from "@/lib/db";
import { Employee, Notification, NotificationPreference } from "@/lib/models";
import { buildNotificationEmailHtml } from "@/lib/password-invite";

interface NotifyParams {
  type: string;
  title: string;
  body: string;
  recipientId?: string;
  hrBroadcast?: boolean;
  href?: string;
  ctaLabel?: string;
  metadata?: Record<string, unknown>;
  /** When true, always email recipients (ignores emailEnabled pref). Still gated by ENABLE_EMAIL_NOTIFICATIONS. */
  forceEmail?: boolean;
  /** Skip outbound email (in-app notification only). */
  skipEmail?: boolean;
}

export async function notify(params: NotifyParams) {
  await connectDB();
  const recipients: string[] = [];

  if (params.hrBroadcast) {
    const hrUsers = await Employee.find({ role: "hr", accountActive: true });
    recipients.push(...hrUsers.map((u) => u._id.toString()));
  } else if (params.recipientId) {
    recipients.push(params.recipientId);
  }

  const html = buildNotificationEmailHtml({
    title: params.title,
    body: params.body,
    href: params.href,
    ctaLabel: params.ctaLabel,
  });

  for (const userId of recipients) {
    await Notification.create({
      userId,
      title: params.title,
      body: params.body,
      type: params.type,
      href: params.href,
      read: false,
      emailSent: false,
    });

    if (params.skipEmail) continue;

    const prefs = await NotificationPreference.findOne({ employeeId: userId });
    const emailEnabled = params.forceEmail || prefs?.emailEnabled !== false;
    if (emailEnabled && process.env.ENABLE_EMAIL_NOTIFICATIONS === "true") {
      const employee = await Employee.findById(userId);
      if (employee?.email) {
        const sent = await sendEmail({
          to: employee.email,
          subject: params.title,
          html,
          type: params.type,
        });
        if (sent) {
          await Notification.updateOne(
            { userId, title: params.title },
            { $set: { emailSent: true } }
          );
        }
      }
    }
  }

  if (
    !params.skipEmail &&
    params.hrBroadcast &&
    params.forceEmail &&
    process.env.HR_EMAIL &&
    process.env.ENABLE_EMAIL_NOTIFICATIONS === "true"
  ) {
    await sendEmail({
      to: process.env.HR_EMAIL,
      subject: params.title,
      html,
      type: params.type,
    });
  }
}

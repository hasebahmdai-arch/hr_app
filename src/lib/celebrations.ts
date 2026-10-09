import { addDays, format, isWithinInterval, parseISO, setYear } from "date-fns";
import connectDB from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { Employee } from "@/lib/models";
import { notify } from "@/lib/notifications";

export function getUpcomingBirthdays(days = 7) {
  const today = new Date();
  const end = addDays(today, days);
  return { today, end };
}

function dobMonthDay(dob: string) {
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(dob)) return format(parseISO(dob.slice(0, 10)), "MM-dd");
    if (/^\d{2}-\d{2}$/.test(dob)) return dob;
  } catch {
    /* ignore */
  }
  return null;
}

export async function getBirthdaysAndAnniversaries() {
  await connectDB();
  const employees = await Employee.find({ accountActive: true });
  const { today, end } = getUpcomingBirthdays(7);
  const birthdays: unknown[] = [];
  const anniversaries: unknown[] = [];
  const year = today.getFullYear();

  for (const emp of employees) {
    const dob = emp.personalInfo?.dateOfBirth;
    if (dob) {
      try {
        const base = parseISO(dob.length >= 10 ? dob.slice(0, 10) : `${year}-${dob}`);
        const dobDate = setYear(base, year);
        if (isWithinInterval(dobDate, { start: today, end })) {
          birthdays.push({
            _id: emp._id.toString(),
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeCode: emp.employeeCode,
            avatarFileId: emp.avatarFileId?.toString(),
            date: format(dobDate, "MMM d"),
          });
        }
      } catch {
        /* skip bad DOB */
      }
    }
    if (emp.hireDate) {
      const hire = setYear(new Date(emp.hireDate), year);
      if (isWithinInterval(hire, { start: today, end: addDays(today, 30) })) {
        const milestone = year - new Date(emp.hireDate).getFullYear();
        anniversaries.push({
          _id: emp._id.toString(),
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeCode: emp.employeeCode,
          avatarFileId: emp.avatarFileId?.toString(),
          milestone,
          date: format(hire, "MMM d"),
        });
      }
    }
  }
  return { birthdays, anniversaries };
}

/** Celebrations happening in exactly `daysAhead` calendar days. */
export async function getCelebrationsInDays(daysAhead: number) {
  await connectDB();
  const employees = await Employee.find({ accountActive: true });
  const target = addDays(new Date(), daysAhead);
  const targetMd = format(target, "MM-dd");
  const birthdays: { name: string; date: string }[] = [];
  const anniversaries: { name: string; date: string; years: number }[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const dob = emp.personalInfo?.dateOfBirth;
    const md = dob ? dobMonthDay(dob) : null;
    if (md === targetMd) {
      birthdays.push({ name, date: format(target, "MMM d") });
    }
    if (emp.hireDate && format(new Date(emp.hireDate), "MM-dd") === targetMd) {
      const years = target.getFullYear() - new Date(emp.hireDate).getFullYear();
      anniversaries.push({ name, date: format(target, "MMM d"), years });
    }
  }

  return { birthdays, anniversaries, targetDate: format(target, "MMM d, yyyy") };
}

async function emailHrRecipients(subject: string, html: string, type: string) {
  await connectDB();
  const hrUsers = await Employee.find({ role: "hr", accountActive: true }).select("email").lean();
  const emails = new Set(hrUsers.map((u) => u.email).filter(Boolean));
  if (process.env.HR_EMAIL) emails.add(process.env.HR_EMAIL);

  for (const to of Array.from(emails)) {
    await sendEmail({ to, subject, html, type });
  }
}

export async function runHrCelebrationPrepEmails() {
  const { birthdays, anniversaries, targetDate } = await getCelebrationsInDays(2);
  if (!birthdays.length && !anniversaries.length) return { sent: false };

  const birthdayLines = birthdays.map((b) => `<li>${b.name} — ${b.date}</li>`).join("");
  const anniversaryLines = anniversaries
    .map((a) => `<li>${a.name} — ${a.date} (${a.years} years)</li>`)
    .join("");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="font-weight: 700; color: #F97316;">Analytico HRMS</p>
      <h1 style="font-size: 20px;">Upcoming celebrations in 2 days</h1>
      <p>Please prepare for the following on <strong>${targetDate}</strong>:</p>
      ${birthdayLines ? `<p><strong>Birthdays</strong></p><ul>${birthdayLines}</ul>` : ""}
      ${anniversaryLines ? `<p><strong>Work anniversaries</strong></p><ul>${anniversaryLines}</ul>` : ""}
      <p style="margin-top: 24px;">
        <a href="${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/app/dashboard"
           style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          Open dashboard
        </a>
      </p>
    </div>
  `;

  await emailHrRecipients("Upcoming birthdays & anniversaries (in 2 days)", html, "CELEBRATION_PREP");
  return { sent: true, birthdays: birthdays.length, anniversaries: anniversaries.length };
}

export async function runCelebrationNotifications() {
  await connectDB();
  const employees = await Employee.find({ accountActive: true });
  const today = new Date();
  const todayStr = format(today, "MM-dd");

  for (const emp of employees) {
    const dob = emp.personalInfo?.dateOfBirth;
    const md = dob ? dobMonthDay(dob) : null;
    if (md === todayStr) {
      await notify({
        type: "BIRTHDAY",
        recipientId: emp._id.toString(),
        title: "Happy Birthday!",
        body: `Wishing you a wonderful birthday, ${emp.firstName}!\n\nYour team at Analytico wishes you a great day.`,
        href: "/app/dashboard",
        ctaLabel: "Open dashboard",
      });
    }
    if (emp.hireDate && format(new Date(emp.hireDate), "MM-dd") === todayStr) {
      const years = today.getFullYear() - new Date(emp.hireDate).getFullYear();
      await notify({
        type: "ANNIVERSARY",
        recipientId: emp._id.toString(),
        title: "Work Anniversary",
        body: `Congratulations on your ${years}-year work anniversary, ${emp.firstName}!\n\nThank you for being part of the Analytico team.`,
        href: "/app/dashboard",
        ctaLabel: "Open dashboard",
      });
    }
  }

  await runHrCelebrationPrepEmails();
}

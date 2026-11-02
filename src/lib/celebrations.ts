import { addDays, format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import connectDB from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { Employee } from "@/lib/models";
import { notify } from "@/lib/notifications";

function companyTimezone() {
  return process.env.COMPANY_TIMEZONE || "Asia/Karachi";
}

/** Today's calendar date in company TZ as yyyy-MM-dd. */
export function todayDateStr(now = new Date()) {
  return format(toZonedTime(now, companyTimezone()), "yyyy-MM-dd");
}

export function todayMd(now = new Date()) {
  return format(toZonedTime(now, companyTimezone()), "MM-dd");
}

/** Extract MM-dd from DOB string (yyyy-MM-dd or MM-dd). */
export function monthDayFromDob(dob: string): string | null {
  try {
    const trimmed = dob.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(5, 10);
    if (/^\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  } catch {
    /* ignore */
  }
  return null;
}

/** Extract MM-dd from hire date without TZ day-shift (prefer ISO date part). */
export function monthDayFromHire(hireDate: Date | string): string | null {
  try {
    if (typeof hireDate === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(hireDate)) return hireDate.slice(5, 10);
      return format(parseISO(hireDate), "MM-dd");
    }
    // Prefer UTC calendar date for Date objects stored as midnight UTC
    const iso = hireDate.toISOString();
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(5, 10);
    return format(hireDate, "MM-dd");
  } catch {
    return null;
  }
}

function hireYear(hireDate: Date | string): number | null {
  try {
    if (typeof hireDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(hireDate)) {
      return Number(hireDate.slice(0, 4));
    }
    if (typeof hireDate === "string") return parseISO(hireDate).getUTCFullYear();
    return hireDate.getUTCFullYear();
  } catch {
    return null;
  }
}

/**
 * Next occurrence of month-day on or after `fromYmd` (yyyy-MM-dd).
 * Handles year wrap (e.g. Dec 30 → Jan 5).
 */
export function nextOccurrence(md: string, fromYmd: string): string {
  const year = Number(fromYmd.slice(0, 4));
  const candidate = `${year}-${md}`;
  if (candidate >= fromYmd) return candidate;
  return `${year + 1}-${md}`;
}

/** Inclusive days from today (company TZ) until next occurrence of md. */
export function daysUntil(md: string, now = new Date()): number {
  const from = todayDateStr(now);
  const next = nextOccurrence(md, from);
  const fromMs = parseISO(from).getTime();
  const nextMs = parseISO(next).getTime();
  return Math.round((nextMs - fromMs) / (24 * 60 * 60 * 1000));
}

function formatDisplayDate(ymd: string) {
  return format(parseISO(ymd), "MMM d");
}

function formatDisplayDateLong(ymd: string) {
  return format(parseISO(ymd), "MMM d, yyyy");
}

export type CelebrationPerson = {
  _id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  avatarFileId?: string;
  date: string;
};

export type AnniversaryPerson = CelebrationPerson & { milestone: number };

export async function getBirthdaysAndAnniversaries() {
  await connectDB();
  const employees = await Employee.find({ accountActive: true })
    .select("firstName lastName employeeCode avatarFileId personalInfo.dateOfBirth hireDate")
    .lean();

  const from = todayDateStr();
  const birthdays: CelebrationPerson[] = [];
  const anniversaries: AnniversaryPerson[] = [];

  for (const emp of employees) {
    const dob = emp.personalInfo?.dateOfBirth;
    const dobMd = dob ? monthDayFromDob(dob) : null;
    if (dobMd) {
      const until = daysUntil(dobMd);
      if (until >= 0 && until <= 7) {
        const next = nextOccurrence(dobMd, from);
        birthdays.push({
          _id: emp._id.toString(),
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeCode: emp.employeeCode,
          avatarFileId: emp.avatarFileId?.toString(),
          date: formatDisplayDate(next),
        });
      }
    }

    if (emp.hireDate) {
      const hireMd = monthDayFromHire(emp.hireDate as Date | string);
      const yearHired = hireYear(emp.hireDate as Date | string);
      if (hireMd && yearHired != null) {
        const until = daysUntil(hireMd);
        const next = nextOccurrence(hireMd, from);
        const milestone = Number(next.slice(0, 4)) - yearHired;
        if (until >= 0 && until <= 30 && milestone >= 1) {
          anniversaries.push({
            _id: emp._id.toString(),
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeCode: emp.employeeCode,
            avatarFileId: emp.avatarFileId?.toString(),
            milestone,
            date: formatDisplayDate(next),
          });
        }
      }
    }
  }

  birthdays.sort((a, b) => a.date.localeCompare(b.date));
  anniversaries.sort((a, b) => a.date.localeCompare(b.date));
  return { birthdays, anniversaries };
}

/** Celebrations happening in exactly `daysAhead` calendar days (company TZ). */
export async function getCelebrationsInDays(daysAhead: number) {
  await connectDB();
  const employees = await Employee.find({ accountActive: true })
    .select("firstName lastName personalInfo.dateOfBirth hireDate")
    .lean();

  const from = todayDateStr();
  const target = format(addDays(parseISO(from), daysAhead), "yyyy-MM-dd");
  const targetMd = target.slice(5, 10);

  const birthdays: { name: string; date: string }[] = [];
  const anniversaries: { name: string; date: string; years: number }[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const dob = emp.personalInfo?.dateOfBirth;
    const dobMd = dob ? monthDayFromDob(dob) : null;
    if (dobMd === targetMd) {
      birthdays.push({ name, date: formatDisplayDate(target) });
    }
    if (emp.hireDate) {
      const hireMd = monthDayFromHire(emp.hireDate as Date | string);
      const yearHired = hireYear(emp.hireDate as Date | string);
      if (hireMd === targetMd && yearHired != null) {
        const years = Number(target.slice(0, 4)) - yearHired;
        if (years >= 1) {
          anniversaries.push({ name, date: formatDisplayDate(target), years });
        }
      }
    }
  }

  return { birthdays, anniversaries, targetDate: formatDisplayDateLong(target) };
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

function celebrationEmailHtml(opts: {
  heading: string;
  intro: string;
  birthdayLines: string;
  anniversaryLines: string;
}) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="font-weight: 700; color: #F97316;">Analytico HRMS</p>
      <h1 style="font-size: 20px;">${opts.heading}</h1>
      <p>${opts.intro}</p>
      ${opts.birthdayLines ? `<p><strong>Birthdays</strong></p><ul>${opts.birthdayLines}</ul>` : ""}
      ${opts.anniversaryLines ? `<p><strong>Work anniversaries</strong></p><ul>${opts.anniversaryLines}</ul>` : ""}
      <p style="margin-top: 24px;">
        <a href="${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/app/dashboard"
           style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          Open dashboard
        </a>
      </p>
    </div>
  `;
}

export async function runHrCelebrationPrepEmails() {
  const { birthdays, anniversaries, targetDate } = await getCelebrationsInDays(2);
  if (!birthdays.length && !anniversaries.length) return { sent: false };

  const birthdayLines = birthdays.map((b) => `<li>${b.name} — ${b.date}</li>`).join("");
  const anniversaryLines = anniversaries
    .map((a) => `<li>${a.name} — ${a.date} (${a.years} years)</li>`)
    .join("");

  const html = celebrationEmailHtml({
    heading: "Upcoming celebrations in 2 days",
    intro: `Please prepare for the following on <strong>${targetDate}</strong>:`,
    birthdayLines,
    anniversaryLines,
  });

  await emailHrRecipients("Upcoming birthdays & anniversaries (in 2 days)", html, "CELEBRATION_PREP");
  return { sent: true, birthdays: birthdays.length, anniversaries: anniversaries.length };
}

async function runHrSameDayDigest(opts: {
  birthdays: { name: string }[];
  anniversaries: { name: string; years: number }[];
  todayLabel: string;
}) {
  if (!opts.birthdays.length && !opts.anniversaries.length) return;

  const birthdayNames = opts.birthdays.map((b) => b.name);
  const anniversaryBits = opts.anniversaries.map((a) => `${a.name} (${a.years}y)`);

  const lines: string[] = [];
  if (birthdayNames.length) lines.push(`Birthdays: ${birthdayNames.join(", ")}`);
  if (anniversaryBits.length) lines.push(`Anniversaries: ${anniversaryBits.join(", ")}`);

  await notify({
    type: "CELEBRATION",
    hrBroadcast: true,
    forceEmail: true,
    title: `Celebrations today — ${opts.todayLabel}`,
    body: `${lines.join("\n")}\n\nOpen the dashboard to see upcoming birthdays and anniversaries.`,
    href: "/app/dashboard",
    ctaLabel: "Open dashboard",
    skipEmail: true, // dedicated digest email below (includes HR_EMAIL)
  });

  const birthdayLines = opts.birthdays.map((b) => `<li>${b.name}</li>`).join("");
  const anniversaryLines = opts.anniversaries
    .map((a) => `<li>${a.name} — ${a.years} years</li>`)
    .join("");

  const html = celebrationEmailHtml({
    heading: "Celebrations today",
    intro: `Here are today's birthdays and work anniversaries (<strong>${opts.todayLabel}</strong>):`,
    birthdayLines,
    anniversaryLines,
  });

  await emailHrRecipients(`Celebrations today — ${opts.todayLabel}`, html, "CELEBRATION_TODAY");
}

export async function runCelebrationNotifications() {
  await connectDB();
  const employees = await Employee.find({ accountActive: true });
  const todayStr = todayMd();
  const todayYmd = todayDateStr();
  const todayLabel = formatDisplayDateLong(todayYmd);
  const yearNow = Number(todayYmd.slice(0, 4));

  const hrBirthdays: { name: string }[] = [];
  const hrAnniversaries: { name: string; years: number }[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const dob = emp.personalInfo?.dateOfBirth;
    const md = dob ? monthDayFromDob(dob) : null;
    if (md === todayStr) {
      hrBirthdays.push({ name });
      await notify({
        type: "BIRTHDAY",
        recipientId: emp._id.toString(),
        title: "Happy Birthday!",
        body: `Wishing you a wonderful birthday, ${emp.firstName}!\n\nYour team at Analytico wishes you a great day.`,
        href: "/app/dashboard",
        ctaLabel: "Open dashboard",
      });
    }

    if (emp.hireDate) {
      const hireMd = monthDayFromHire(emp.hireDate as Date | string);
      const yearHired = hireYear(emp.hireDate as Date | string);
      if (hireMd === todayStr && yearHired != null) {
        const years = yearNow - yearHired;
        if (years >= 1) {
          hrAnniversaries.push({ name, years });
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
    }
  }

  await runHrSameDayDigest({
    birthdays: hrBirthdays,
    anniversaries: hrAnniversaries,
    todayLabel,
  });

  await runHrCelebrationPrepEmails();
}

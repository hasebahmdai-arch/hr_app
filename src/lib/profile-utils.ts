import { parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "personalInfo.dateOfBirth",
  "personalInfo.gender",
  "contactInfo.currentAddress",
  "contactInfo.personalPhone",
  "designation",
  "departmentId",
  "shiftId",
  "hireDate",
];

export function calculateProfileCompletion(employee: Record<string, unknown>) {
  let filled = 0;
  for (const field of PROFILE_FIELDS) {
    const parts = field.split(".");
    let value: unknown = employee;
    for (const p of parts) value = (value as Record<string, unknown>)?.[p];
    if (value !== undefined && value !== null && value !== "") filled++;
  }
  return Math.round((filled / PROFILE_FIELDS.length) * 10000) / 100;
}

export function computeAttendancePct(
  records: { statusCode: string }[],
  monthDays: number
) {
  const present = records.filter((r) => ["P", "W", "O"].includes(r.statusCode)).length;
  const excluded = records.filter((r) => ["L", "SL", "H", "D"].includes(r.statusCode)).length;
  const denominator = Math.max(monthDays - excluded, 1);
  return Math.round((present / denominator) * 100);
}

export function shiftToMinutes(start: string, end: string, breakMinutes = 60) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm) - breakMinutes;
}

export function minutesToTimeLabel(minutes: number | null) {
  if (minutes === null) return null;
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function dateToCheckInMinutes(iso?: string | Date | null) {
  if (!iso) return null;
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  const tz = process.env.COMPANY_TIMEZONE || "Asia/Karachi";
  const zoned = toZonedTime(d, tz);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export function workedSecondsBetween(checkIn?: Date | null, checkOut?: Date | null) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(Math.floor((checkOut.getTime() - checkIn.getTime()) / 1000), 0);
}

export function workedMinutesBetween(checkIn?: Date | null, checkOut?: Date | null) {
  return Math.floor(workedSecondsBetween(checkIn, checkOut) / 60);
}

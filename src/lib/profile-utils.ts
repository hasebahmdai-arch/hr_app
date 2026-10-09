import { differenceInMinutes, parseISO } from "date-fns";

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
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dateToCheckInMinutes(iso?: string | Date | null) {
  if (!iso) return null;
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return d.getHours() * 60 + d.getMinutes();
}

export function workedMinutesBetween(checkIn?: Date | null, checkOut?: Date | null) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(differenceInMinutes(checkOut, checkIn), 0);
}

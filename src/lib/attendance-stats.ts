import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parse,
  parseISO,
  startOfMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

const NON_ABSENT_CODES = new Set(["L", "SL", "W", "H", "D", "O", "T"]);
const PRESENT_CODES = new Set(["P", "W", "O"]);

function companyTimezone() {
  return process.env.COMPANY_TIMEZONE || "Asia/Karachi";
}

export function todayInCompanyTz(now = new Date()) {
  return format(toZonedTime(now, companyTimezone()), "yyyy-MM-dd");
}

export function isWeekendDate(dateStr: string) {
  const day = getDay(parseISO(dateStr));
  return day === 0 || day === 6;
}

export type TimesheetStatRow = {
  date: string;
  statusCode?: string;
  checkIn?: Date | string | null;
  sessions?: { checkIn?: Date | string | null }[];
  checkinStatus?: string | null;
  checkoutStatus?: string | null;
  isWeekendWork?: boolean;
  isHolidayWork?: boolean;
};

export type AttendanceStatTiles = {
  absents: number;
  late: number;
  missedCheckouts: number;
  weekendWork: number;
  holidayWork: number;
  present: number;
  onLeave: number;
  wfhDays: number;
  attendancePct: number;
};

function hasPresence(r: TimesheetStatRow) {
  if (r.checkIn) return true;
  if (r.sessions?.some((s) => s.checkIn)) return true;
  return false;
}

export function computeStatTiles(opts: {
  month: string;
  records: TimesheetStatRow[];
  holidayDates: Set<string>;
  hireDate?: Date | string | null;
  throughDate?: string;
}): AttendanceStatTiles {
  const monthStart = startOfMonth(parse(opts.month, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const through = opts.throughDate ?? todayInCompanyTz();
  const hireStr = opts.hireDate
    ? format(
        typeof opts.hireDate === "string" ? parseISO(opts.hireDate.slice(0, 10)) : opts.hireDate,
        "yyyy-MM-dd"
      )
    : null;

  const byDate = new Map(opts.records.map((r) => [r.date, r]));
  let absents = 0;
  let late = 0;
  let missedCheckouts = 0;
  let weekendWork = 0;
  let holidayWork = 0;
  let present = 0;
  let onLeave = 0;
  let wfhDays = 0;
  let presentForPct = 0;
  let denom = 0;

  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    const date = format(day, "yyyy-MM-dd");
    if (date > through) continue;
    if (hireStr && date < hireStr) continue;

    const record = byDate.get(date);
    const weekend = isWeekendDate(date);
    const holiday = opts.holidayDates.has(date);
    const code = record?.statusCode;
    const presentDay = Boolean(record && hasPresence(record));

    if (record?.checkinStatus === "Late") late += 1;
    if (record?.checkoutStatus === "Missed") missedCheckouts += 1;
    if (record && (record.isWeekendWork || (presentDay && weekend))) weekendWork += 1;
    if (record && (record.isHolidayWork || (presentDay && holiday))) holidayWork += 1;
    if (code === "L" || code === "SL") onLeave += 1;
    if (code === "W") wfhDays += 1;
    if (presentDay || (code && PRESENT_CODES.has(code))) present += 1;

    if (weekend || holiday) continue;
    if (code && NON_ABSENT_CODES.has(code) && !presentDay) continue;

    denom += 1;
    if (presentDay || (code && PRESENT_CODES.has(code))) {
      presentForPct += 1;
    } else {
      absents += 1;
    }
  }

  return {
    absents,
    late,
    missedCheckouts,
    weekendWork,
    holidayWork,
    present,
    onLeave,
    wfhDays,
    attendancePct: denom > 0 ? Math.round((presentForPct / denom) * 100) : 0,
  };
}

export function aggregateStatTiles(tiles: AttendanceStatTiles[]): AttendanceStatTiles {
  const sum: AttendanceStatTiles = {
    absents: 0,
    late: 0,
    missedCheckouts: 0,
    weekendWork: 0,
    holidayWork: 0,
    present: 0,
    onLeave: 0,
    wfhDays: 0,
    attendancePct: 0,
  };
  if (!tiles.length) return sum;
  for (const t of tiles) {
    sum.absents += t.absents;
    sum.late += t.late;
    sum.missedCheckouts += t.missedCheckouts;
    sum.weekendWork += t.weekendWork;
    sum.holidayWork += t.holidayWork;
    sum.present += t.present;
    sum.onLeave += t.onLeave;
    sum.wfhDays += t.wfhDays;
    sum.attendancePct += t.attendancePct;
  }
  sum.attendancePct = Math.round(sum.attendancePct / tiles.length);
  return sum;
}

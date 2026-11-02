import { Holiday } from "@/lib/models";

export async function getHolidayDatesInRange(from: string, to: string) {
  const rows = await Holiday.find({
    isActive: true,
    date: { $gte: from, $lte: to },
  })
    .select("date name")
    .lean();
  return rows.map((r) => ({
    date: r.date as string,
    name: (r.name as string) || "Holiday",
  }));
}

export async function isHoliday(dateStr: string) {
  const found = await Holiday.findOne({ date: dateStr, isActive: true }).select("_id").lean();
  return Boolean(found);
}

export async function getHolidayDateSet(from: string, to: string) {
  const rows = await getHolidayDatesInRange(from, to);
  return new Set(rows.map((r) => r.date));
}

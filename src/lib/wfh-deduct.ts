import connectDB from "@/lib/db";
import { creditDays, deductOneDay, leaveYearFromDate } from "@/lib/leave-balance";
import { Employee, Timesheet, WfhRequest } from "@/lib/models";
import { calendarDateString, todayInCompanyTz } from "@/lib/timesheet-auto-checkout";

const BATCH_LIMIT = 200;

type WfhDoc = {
  _id: { toString(): string };
  employeeId: { toString(): string };
  dates: Date[];
  daysRequested?: number;
  daysDeductedSoFar?: number;
  deductedDates?: string[];
  save(): Promise<unknown>;
};

function wfhDateStrings(dates: Date[] = []) {
  return dates.map((d) => calendarDateString(d)).filter(Boolean).sort();
}

async function markWfhDay(employeeId: string, date: string) {
  const employee = await Employee.findById(employeeId).select("shiftId").lean();
  await Timesheet.findOneAndUpdate(
    { employeeId, date },
    {
      $set: {
        statusCode: "W",
        source: "manual",
        shiftId: employee?.shiftId,
      },
      $setOnInsert: {
        expectedMinutes: 480,
        workedMinutes: 0,
        shortMinutes: 0,
        breakMinutes: 0,
        breaks: [],
        sessions: [],
      },
    },
    { upsert: true }
  );
}

async function processOneWfh(doc: WfhDoc, today: string) {
  const deducted = new Set(doc.deductedDates ?? []);
  const pending = wfhDateStrings(doc.dates ?? []).filter((d) => d <= today && !deducted.has(d));
  if (!pending.length) return 0;

  let applied = 0;
  for (const date of pending) {
    const year = leaveYearFromDate(date);
    await deductOneDay(doc.employeeId.toString(), "WFH", year);
    await markWfhDay(doc.employeeId.toString(), date);
    deducted.add(date);
    applied += 1;
  }

  doc.deductedDates = Array.from(deducted).sort();
  doc.daysDeductedSoFar = doc.deductedDates.length;
  await doc.save();
  return applied;
}

export async function processWfhDeductionsGlobal(limit = BATCH_LIMIT) {
  await connectDB();
  const today = todayInCompanyTz();

  const requests = await WfhRequest.find({
    status: "COMPLETED",
    $expr: { $lt: ["$daysDeductedSoFar", "$daysRequested"] },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let deductedDays = 0;
  for (const req of requests) {
    deductedDays += await processOneWfh(req as unknown as WfhDoc, today);
  }
  return { deductedDays, processed: requests.length, today };
}

export async function processWfhDeductionsForEmployee(employeeId: string) {
  await connectDB();
  const today = todayInCompanyTz();

  const requests = await WfhRequest.find({
    employeeId,
    status: "COMPLETED",
    $expr: { $lt: ["$daysDeductedSoFar", "$daysRequested"] },
  }).limit(50);

  let deductedDays = 0;
  for (const req of requests) {
    deductedDays += await processOneWfh(req as unknown as WfhDoc, today);
  }
  return { deductedDays, today };
}

/** Credit used WFH days and clear pure W rows for deducted dates on cancel. */
export async function revertWfhDeductions(request: {
  employeeId: { toString(): string };
  deductedDates?: string[];
}) {
  const employeeId = request.employeeId.toString();
  const dates = request.deductedDates ?? [];
  const byYear = new Map<number, number>();
  for (const date of dates) {
    const y = leaveYearFromDate(date);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  for (const [year, days] of Array.from(byYear.entries())) {
    await creditDays(employeeId, "WFH", year, days);
  }
  for (const date of dates) {
    await Timesheet.deleteOne({
      employeeId,
      date,
      statusCode: "W",
      checkIn: { $exists: false },
    });
    await Timesheet.updateOne(
      { employeeId, date, statusCode: "W" },
      { $set: { statusCode: "P" } }
    );
  }
}

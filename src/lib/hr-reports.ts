import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parse,
  startOfMonth,
} from "date-fns";
import connectDB from "@/lib/db";
import { REQUEST_TYPES } from "@/lib/constants";
import {
  Department,
  Employee,
  REQUEST_MODELS,
  Timesheet,
} from "@/lib/models";
import { computeAttendancePct } from "@/lib/profile-utils";
import { getSessionState } from "@/lib/timesheet-session";
import type {
  HrAttendanceReport,
  HrDashboardOverview,
  HrRequestsSummary,
} from "@/types/api";

export async function getHrOverview(month: string): Promise<HrDashboardOverview> {
  await connectDB();
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const dateFrom = format(monthStart, "yyyy-MM-dd");
  const dateTo = format(monthEnd, "yyyy-MM-dd");
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;

  const employees = await Employee.find({ role: "employee", accountActive: true }).lean();
  const employeeIds = employees.map((e) => e._id);

  const todaySheets = await Timesheet.find({
    employeeId: { $in: employeeIds },
    date: today,
    checkIn: { $exists: true },
  }).lean();

  let onBreakToday = 0;
  let presentToday = 0;
  for (const sheet of todaySheets) {
    const state = getSessionState({
      checkIn: sheet.checkIn,
      checkOut: sheet.checkOut,
      breaks: sheet.breaks as { startedAt: Date; endedAt?: Date }[],
    });
    if (state === "working" || state === "on_break" || state === "completed") presentToday++;
    if (state === "on_break") onBreakToday++;
  }

  let pendingApprovals = 0;
  for (const Model of Object.values(REQUEST_MODELS)) {
    pendingApprovals += await Model.countDocuments({ status: { $in: ["PENDING", "CANCELING"] } });
  }

  const monthSheets = await Timesheet.find({
    employeeId: { $in: employeeIds },
    date: { $gte: dateFrom, $lte: dateTo },
  }).lean();

  const byEmployee = new Map<string, typeof monthSheets>();
  for (const s of monthSheets) {
    const id = s.employeeId.toString();
    if (!byEmployee.has(id)) byEmployee.set(id, []);
    byEmployee.get(id)!.push(s);
  }

  let pctSum = 0;
  let pctCount = 0;
  for (const emp of employees) {
    const records = byEmployee.get(emp._id.toString()) ?? [];
    if (records.length) {
      pctSum += computeAttendancePct(records, monthDays);
      pctCount++;
    }
  }

  return {
    totalEmployees: employees.length,
    presentToday,
    onBreakToday,
    pendingApprovals,
    avgAttendancePct: pctCount ? Math.round(pctSum / pctCount) : 0,
  };
}

export async function getHrAttendanceReport(
  month: string,
  departmentId?: string
): Promise<HrAttendanceReport> {
  await connectDB();
  const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const dateFrom = format(monthStart, "yyyy-MM-dd");
  const dateTo = format(monthEnd, "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const empFilter: Record<string, unknown> = { role: "employee", accountActive: true };
  if (departmentId) empFilter.departmentId = departmentId;

  const [employees, departments, sheets] = await Promise.all([
    Employee.find(empFilter).populate("departmentId", "name").lean(),
    Department.find({ isActive: true }).lean(),
    Timesheet.find({
      date: { $gte: dateFrom, $lte: dateTo },
    }).lean(),
  ]);

  const empIds = new Set(employees.map((e) => e._id.toString()));
  const filteredSheets = sheets.filter((s) => empIds.has(s.employeeId.toString()));

  const byEmployee = new Map<string, typeof filteredSheets>();
  for (const s of filteredSheets) {
    const id = s.employeeId.toString();
    if (!byEmployee.has(id)) byEmployee.set(id, []);
    byEmployee.get(id)!.push(s);
  }

  const employeeRows = employees.map((emp) => {
    const records = byEmployee.get(emp._id.toString()) ?? [];
    const todaySheet = records.find((r) => r.date === today);
    let statusToday = "Absent";
    if (todaySheet?.checkIn) {
      const state = getSessionState({
        checkIn: todaySheet.checkIn,
        checkOut: todaySheet.checkOut,
        breaks: todaySheet.breaks as { startedAt: Date; endedAt?: Date }[],
      });
      if (state === "completed") statusToday = "Completed";
      else if (state === "on_break") statusToday = "On Break";
      else statusToday = "Present";
    }
    const lateCount = records.filter((r) => r.checkinStatus && r.checkinStatus !== "On Time").length;
    const dept = emp.departmentId as { name?: string } | null;
    return {
      employeeId: emp._id.toString(),
      firstName: emp.firstName,
      lastName: emp.lastName,
      employeeCode: emp.employeeCode,
      department: dept?.name,
      daysPresent: records.filter((r) => ["P", "W", "O"].includes(r.statusCode)).length,
      attendancePct: records.length ? computeAttendancePct(records, monthDays) : 0,
      lateCount,
      statusToday,
    };
  });

  const deptAgg = departments.map((d) => {
    const deptEmps = employeeRows.filter(
      (e) => employees.find((emp) => emp._id.toString() === e.employeeId)?.departmentId?.toString() === d._id.toString()
    );
    const avg =
      deptEmps.length > 0
        ? Math.round(deptEmps.reduce((s, e) => s + e.attendancePct, 0) / deptEmps.length)
        : 0;
    return {
      departmentId: d._id.toString(),
      name: d.name,
      attendancePct: avg,
      employeeCount: deptEmps.length,
    };
  });

  const dailyPresentTrend = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const present = filteredSheets.filter(
      (s) => s.date === dateStr && s.checkIn && ["P", "W", "O"].includes(s.statusCode)
    ).length;
    return { date: dateStr, present };
  });

  return {
    month,
    departmentAggregates: deptAgg,
    employees: employeeRows,
    dailyPresentTrend,
  };
}

export async function getHrRequestsSummary(limit = 10): Promise<HrRequestsSummary> {
  await connectDB();
  const byStatus: Record<string, number> = {};
  const recent: HrRequestsSummary["recent"] = [];

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(monthStart);

  for (const type of REQUEST_TYPES) {
    const Model = REQUEST_MODELS[type];
    const statuses = await Model.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    for (const s of statuses) {
      byStatus[s._id] = (byStatus[s._id] || 0) + s.count;
    }

    const pending = await Model.find({ status: { $in: ["PENDING", "CANCELING"] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("employeeId", "firstName lastName")
      .lean();

    for (const p of pending) {
      const row = p as Record<string, unknown>;
      const emp = row.employeeId as { firstName?: string; lastName?: string; _id?: { toString(): string } } | null;
      recent.push({
        _id: (row._id as { toString(): string }).toString(),
        requestCode: row.requestCode as string,
        type,
        status: row.status as string,
        employeeId: emp?._id?.toString?.() ?? String(row.employeeId),
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        createdAt: (row.createdAt as Date).toISOString(),
      });
    }
  }

  recent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { byStatus, recent: recent.slice(0, limit) };
}

export function escapeCsv(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

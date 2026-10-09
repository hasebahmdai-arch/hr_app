import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { REQUEST_TYPES } from "@/lib/constants";
import {
  getHrAttendanceReport,
  toCsv,
} from "@/lib/hr-reports";
import { Employee, REQUEST_MODELS } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireHR();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    const departmentId = searchParams.get("departmentId") || undefined;

    if (!type || !["attendance", "requests", "employees"].includes(type)) {
      return apiError("Invalid report type", "VALIDATION_ERROR", 400);
    }

    let csv = "";
    let filename = `report-${type}-${month}.csv`;

    if (type === "attendance") {
      const report = await getHrAttendanceReport(month, departmentId);
      const rows: string[][] = [
        ["Employee Code", "Name", "Department", "Days Present", "Attendance %", "Late Count", "Status Today"],
      ];
      for (const e of report.employees) {
        rows.push([
          e.employeeCode,
          `${e.firstName} ${e.lastName}`,
          e.department ?? "",
          String(e.daysPresent),
          String(e.attendancePct),
          String(e.lateCount),
          e.statusToday,
        ]);
      }
      csv = toCsv(rows);
    } else if (type === "employees") {
      await connectDB();
      const filter: Record<string, unknown> = { accountActive: true };
      if (departmentId) filter.departmentId = departmentId;
      const employees = await Employee.find(filter).populate("departmentId", "name").lean();
      const rows: string[][] = [["Code", "First Name", "Last Name", "Email", "Role", "Designation", "Department", "Active"]];
      for (const e of employees) {
        const dept = e.departmentId as { name?: string } | null;
        rows.push([
          e.employeeCode,
          e.firstName,
          e.lastName,
          e.email,
          e.role,
          e.designation ?? "",
          dept?.name ?? "",
          e.accountActive ? "Yes" : "No",
        ]);
      }
      csv = toCsv(rows);
      filename = "employees.csv";
    } else {
      await connectDB();
      const monthStart = startOfMonth(parse(month, "yyyy-MM", new Date()));
      const monthEnd = endOfMonth(monthStart);
      const rows: string[][] = [["Request Code", "Type", "Status", "Employee", "Created At"]];
      for (const reqType of REQUEST_TYPES) {
        const Model = REQUEST_MODELS[reqType];
        const items = await Model.find({ createdAt: { $gte: monthStart, $lte: monthEnd } })
          .populate("employeeId", "firstName lastName employeeCode")
          .sort({ createdAt: -1 })
          .lean();
        for (const item of items) {
          const row = item as Record<string, unknown>;
          const emp = row.employeeId as { firstName?: string; lastName?: string; employeeCode?: string } | null;
          rows.push([
            row.requestCode as string,
            reqType,
            row.status as string,
            emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeCode})` : "",
            (row.createdAt as Date).toISOString(),
          ]);
        }
      }
      csv = toCsv(rows);
      filename = `requests-${month}.csv`;
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

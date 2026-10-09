"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Users, UserCheck, Bell, TrendingUp, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useHrDashboard, downloadHrReport } from "@/hooks/use-hr-dashboard";
import { useRequestInbox } from "@/hooks/use-request-inbox";
import { useDashboard } from "@/hooks/use-dashboard";
import { useDepartments } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Avatar } from "@/components/shared/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REQUEST_LABELS } from "@/lib/navigation";
import type { RequestType } from "@/lib/constants";

const ORANGE = "#F97316";
const PIE_COLORS = ["#F97316", "#FB923C", "#FDBA74", "#16a34a", "#ef4444", "#6b7280"];

export function HrDashboardWeb() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const { overview, attendance, requests, isLoading, isError, refetchAll } = useHrDashboard(month, departmentId || undefined);
  const { data: inbox } = useRequestInbox("ATTENTION", 1);
  const { celebrations } = useDashboard(month, true);
  const { data: departments } = useDepartments();

  const ov = overview.data;
  const att = attendance.data;
  const req = requests.data;
  const cel = celebrations.data;

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(format(new Date(y, m - 1 + delta, 1), "yyyy-MM"));
  }

  const filteredEmployees = att?.employees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q)
    );
  });

  const pieData = req?.byStatus
    ? Object.entries(req.byStatus).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Dashboard"
        subtitle="Team attendance, requests, and reports"
        action={<Button variant="outline" size="sm" onClick={() => refetchAll()}>Refresh</Button>}
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetchAll}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Employees" value={ov?.totalEmployees ?? 0} icon={<Users className="h-8 w-8" />} />
          <KpiCard label="Present Today" value={ov?.presentToday ?? 0} icon={<UserCheck className="h-8 w-8" />} accent="success" />
          <KpiCard label="Pending Approvals" value={ov?.pendingApprovals ?? 0} icon={<Bell className="h-8 w-8" />} accent="warning" />
          <KpiCard label="Avg Attendance" value={`${ov?.avgAttendancePct ?? 0}%`} icon={<TrendingUp className="h-8 w-8" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle className="text-base">Attendance by Department</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={att?.departmentAggregates ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="attendancePct" fill={ORANGE} radius={[4, 4, 0, 0]} name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle className="text-base">Requests by Status</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Daily Present Trend</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium">{format(new Date(month + "-01"), "MMMM yyyy")}</span>
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={att?.dailyPresentTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(-2)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="present" stroke={ORANGE} strokeWidth={2} dot={false} name="Present" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending Requests</CardTitle>
            <Link href="/app/requests?status=PENDING">
              <Button variant="outline" size="sm">View inbox</Button>
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Code</th>
                  <th className="p-2 font-medium">Employee</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {inbox?.items.slice(0, 5).map((r) => (
                  <tr key={`${r.type}-${r._id}`} className="border-b hover:bg-muted-bg/50">
                    <td className="p-2 font-mono text-xs">{r.requestCode}</td>
                    <td className="p-2">
                      <Link href={`/app/people/${r.employeeId}`} className="hover:text-primary">{r.employeeName}</Link>
                    </td>
                    <td className="p-2">{REQUEST_LABELS[r.type as RequestType] ?? r.type}</td>
                    <td className="p-2">{r.status}</td>
                  </tr>
                ))}
                {!inbox?.items.length && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No pending requests</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-end gap-4">
            <CardTitle className="text-base flex-1">Team Attendance</CardTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Department</Label>
                <select className="h-9 rounded-md border px-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">All</option>
                  {departments?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Search</Label>
                <Input className="h-9 w-40" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr className="text-left text-muted-foreground">
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium">Department</th>
                  <th className="p-3 font-medium">Days Present</th>
                  <th className="p-3 font-medium">Attendance %</th>
                  <th className="p-3 font-medium">Today</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees?.map((e) => (
                  <tr key={e.employeeId} className="border-b even:bg-muted-bg/30 hover:bg-primary-tint/30">
                    <td className="p-3">
                      <Link href={`/app/people/${e.employeeId}`} className="font-medium hover:text-primary">
                        {e.firstName} {e.lastName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{e.employeeCode}</p>
                    </td>
                    <td className="p-3">{e.department ?? "—"}</td>
                    <td className="p-3">{e.daysPresent}</td>
                    <td className="p-3 font-medium text-primary">{e.attendancePct}%</td>
                    <td className="p-3">{e.statusToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" />Download Reports</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => downloadHrReport("attendance", month, departmentId || undefined)}>Attendance CSV</Button>
            <Button variant="outline" onClick={() => downloadHrReport("requests", month)}>Requests CSV</Button>
            <Button variant="outline" onClick={() => downloadHrReport("employees", month, departmentId || undefined)}>Employees CSV</Button>
          </CardContent>
        </Card>

        {(cel?.birthdays.length || cel?.anniversaries.length) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle className="text-base">Upcoming Birthdays</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {cel?.birthdays.length ? cel.birthdays.slice(0, 6).map((b) => (
                  <div key={b._id} className="flex items-center gap-2">
                    <Avatar firstName={b.firstName} lastName={b.lastName} fileId={b.avatarFileId} size="sm" />
                    <div><p className="text-sm font-medium">{b.firstName} {b.lastName}</p><p className="text-xs text-muted-foreground">{b.date}</p></div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No birthdays soon</p>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle className="text-base">Upcoming Anniversaries</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {cel?.anniversaries.length ? cel.anniversaries.slice(0, 6).map((a) => (
                  <div key={a._id} className="flex items-center gap-2">
                    <Avatar firstName={a.firstName} lastName={a.lastName} fileId={a.avatarFileId} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">{a.date} · {a.milestone} years</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No anniversaries soon</p>}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}

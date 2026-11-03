"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Users, UserCheck, Bell, TrendingUp, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useHrDashboard, downloadHrReport } from "@/hooks/use-hr-dashboard";
import { useDashboard } from "@/hooks/use-dashboard";
import { useRequestInbox } from "@/hooks/use-request-inbox";
import { useDepartments } from "@/hooks/use-admin";
import { queryKeys } from "@/lib/query-keys";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { KpiCard } from "@/components/shared/KpiCard";
import { Avatar } from "@/components/shared/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { REQUEST_LABELS } from "@/lib/navigation";
import type { RequestType } from "@/lib/constants";
import { AttendanceStatTiles } from "@/components/shared/dashboard/AttendanceStatTiles";
import { ClockWidget } from "@/components/shared/dashboard/ClockWidget";

export function HrDashboardMobile() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [departmentId, setDepartmentId] = useState("");
  const queryClient = useQueryClient();
  const { overview, attendance, isLoading, isError, refetchAll: refetchHr } = useHrDashboard(
    month,
    departmentId || undefined
  );
  const { celebrations, refetchAll: refetchDash } = useDashboard(month, true);
  const { data: inbox } = useRequestInbox("ATTENTION", 1);
  const { data: departments } = useDepartments();
  const ov = overview.data;
  const att = attendance.data;
  const cel = celebrations.data;

  function refetchAll() {
    refetchHr();
    refetchDash();
    void queryClient.invalidateQueries({ queryKey: queryKeys.todaySession() });
    void queryClient.invalidateQueries({ queryKey: ["request-inbox"] });
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(format(new Date(y!, m! - 1 + delta, 1), "yyyy-MM"));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">HR Dashboard</h1>
      <p className="text-sm text-muted-foreground -mt-2">Team overview</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <InputMonth value={month} onChange={setMonth} />
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 min-w-[140px]">
          <Label>Department</Label>
          <select
            className="w-full h-10 rounded-md border px-3 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments?.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ClockWidget />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetchAll}>
        <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Employees" value={ov?.totalEmployees ?? 0} icon={<Users className="h-6 w-6" />} />
          <KpiCard label="Present" value={ov?.presentToday ?? 0} icon={<UserCheck className="h-6 w-6" />} accent="success" />
          <KpiCard label="Pending" value={ov?.pendingApprovals ?? 0} icon={<Bell className="h-6 w-6" />} accent="warning" />
          <KpiCard label="Attendance" value={`${ov?.avgAttendancePct ?? 0}%`} icon={<TrendingUp className="h-6 w-6" />} />
        </div>

        <AttendanceStatTiles tiles={ov?.statTiles} holidays={ov?.holidays} month={month} />

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Birthdays</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
            {cel?.birthdays.length ? cel.birthdays.slice(0, 6).map((b) => (
              <div key={b._id} className="flex items-center gap-2">
                <Avatar firstName={b.firstName} lastName={b.lastName} fileId={b.avatarFileId} size="sm" />
                <div>
                  <p className="text-sm font-medium">{b.firstName} {b.lastName}</p>
                  <p className="text-xs text-muted-foreground">{b.date}</p>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No birthdays soon</p>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Anniversaries</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
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

        <Card className="shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Pending Requests</CardTitle>
            <Link href="/app/requests?status=PENDING"><Button variant="outline" size="sm">Inbox</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {inbox?.items.slice(0, 5).map((r) => (
              <Link key={`${r.type}-${r._id}`} href="/app/requests?status=PENDING" className="block p-3 rounded-xl bg-muted-bg">
                <p className="text-sm font-medium">{r.employeeName}</p>
                <p className="text-xs text-muted-foreground">{REQUEST_LABELS[r.type as RequestType]} · {r.requestCode}</p>
              </Link>
            ))}
            {!inbox?.items.length && <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Team Today</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
            {att?.employees.slice(0, 8).map((e) => (
              <Link key={e.employeeId} href={`/app/people/${e.employeeId}`} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{e.firstName} {e.lastName}</p>
                  <p className="text-xs text-muted-foreground">{e.employeeCode}</p>
                </div>
                <span className="text-xs font-medium text-primary">{e.statusToday}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" />Reports</CardTitle></CardHeader>
          <CardContent className="grid gap-2 pt-4">
            <Button className="w-full" onClick={() => downloadHrReport("attendance", month, departmentId || undefined)}>Attendance CSV</Button>
            <Button variant="outline" className="w-full" onClick={() => downloadHrReport("requests", month)}>Requests CSV</Button>
            <Button variant="outline" className="w-full" onClick={() => downloadHrReport("employees", month, departmentId || undefined)}>Employees CSV</Button>
          </CardContent>
        </Card>
        </div>
      </QueryBoundary>
    </div>
  );
}

function InputMonth({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="month"
      className="h-10 rounded-md border px-2 text-sm"
      value={value}
      onChange={(e) => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
      }}
    />
  );
}

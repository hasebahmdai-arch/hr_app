"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronLeft, ChevronRight, Cake, Award, FileText } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Avatar } from "@/components/shared/Avatar";
import { ClockWidget } from "@/components/shared/dashboard/ClockWidget";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";

const CHART_COLOR = "#F97316";

export function EmployeeDashboardWeb() {
  const { data: session } = useSession();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const { attendance, celebrations, announcements, isLoading, isError, refetchAll } = useDashboard(month, false);

  const att = attendance.data;
  const cel = celebrations.data;
  const ann = announcements.data;
  const name = session?.user?.name?.split(" ")[0];

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(format(new Date(y, m - 1 + delta, 1), "yyyy-MM"));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={name ? `Welcome back, ${name}` : "Your attendance and updates"}
        action={<Button variant="outline" size="sm" onClick={() => refetchAll()}>Refresh</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClockWidget />
        </div>
        <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetchAll}>
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle className="text-base">This Month</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(att?.statusCounters ?? {}).slice(0, 4).map(([code, count]) => (
                  <div key={code} className="text-center p-3 rounded-xl bg-muted-bg">
                    <StatusBadge status={code} />
                    <p className="text-2xl font-bold mt-1">{count}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">Attendance: <span className="font-semibold text-primary">{att?.attendancePct ?? 0}%</span></p>
            </CardContent>
          </Card>
        </QueryBoundary>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Check-in Trend</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[100px] text-center">{format(new Date(month + "-01"), "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={att?.trends ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(-2)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="checkInMinutes" stroke={CHART_COLOR} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cake className="h-4 w-4 text-primary" />Birthdays</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cel?.birthdays.length ? cel.birthdays.map((b) => (
              <div key={b._id} className="flex items-center gap-3">
                <Avatar firstName={b.firstName} lastName={b.lastName} fileId={b.avatarFileId} size="sm" />
                <div><p className="text-sm font-medium">{b.firstName} {b.lastName}</p><p className="text-xs text-muted-foreground">{b.date}</p></div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No birthdays soon</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-primary" />Anniversaries</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cel?.anniversaries.length ? cel.anniversaries.map((a) => (
              <div key={a._id} className="flex items-center gap-3">
                <Avatar firstName={a.firstName} lastName={a.lastName} fileId={a.avatarFileId} size="sm" />
                <div><p className="text-sm font-medium">{a.firstName} {a.lastName}</p><p className="text-xs text-muted-foreground">{a.milestone} years</p></div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No anniversaries soon</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ann?.companyDocuments.length ? ann.companyDocuments.slice(0, 5).map((d) => (
              <a key={d._id} href={`/api/files/${d.fileId}`} target="_blank" rel="noopener" className="block text-sm hover:text-primary truncate">{d.title}</a>
            )) : <p className="text-sm text-muted-foreground">No documents</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="text-base">Announcements</CardTitle></CardHeader>
          <CardContent>
            {ann?.announcements.length ? ann.announcements.slice(0, 3).map((a, i) => (
              <div key={a._id} className={i === 0 ? "p-3 rounded-xl bg-primary-tint mb-2" : "mb-2"}>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No announcements</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Avatar } from "@/components/shared/Avatar";
import { ClockWidget } from "@/components/shared/dashboard/ClockWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function EmployeeDashboardMobile() {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {name && <p className="text-sm text-muted-foreground">Welcome back, {name}</p>}
      </div>

      <ClockWidget />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetchAll}>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Attendance {att?.attendancePct ?? 0}%</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs">{format(new Date(month + "-01"), "MMM yyyy")}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(att?.statusCounters ?? {}).map(([code, count]) => (
                <div key={code} className="flex items-center gap-1"><StatusBadge status={code} /><span className="text-sm font-medium">{count}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>

        {(cel?.birthdays.length ?? 0) > 0 && (
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Birthdays</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cel!.birthdays.map((b) => (
                <div key={b._id} className="flex items-center gap-2">
                  <Avatar firstName={b.firstName} lastName={b.lastName} fileId={b.avatarFileId} size="sm" />
                  <div>
                    <span className="text-sm">{b.firstName} {b.lastName}</span>
                    <p className="text-xs text-muted-foreground">{b.date}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(cel?.anniversaries.length ?? 0) > 0 && (
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Anniversaries</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cel!.anniversaries.map((a) => (
                <div key={a._id} className="flex items-center gap-2">
                  <Avatar firstName={a.firstName} lastName={a.lastName} fileId={a.avatarFileId} size="sm" />
                  <div>
                    <span className="text-sm">{a.firstName} {a.lastName}</span>
                    <p className="text-xs text-muted-foreground">{a.date} · {a.milestone} years</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {ann?.announcements.length ? (
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Announcements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ann.announcements.slice(0, 2).map((a) => (
                <div key={a._id} className="p-3 rounded-xl bg-primary-tint">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </QueryBoundary>
    </div>
  );
}

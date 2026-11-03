"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/hooks/use-dashboard";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Avatar } from "@/components/shared/Avatar";
import { AttendanceStatTiles } from "@/components/shared/dashboard/AttendanceStatTiles";
import { ClockWidget } from "@/components/shared/dashboard/ClockWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";

export function EmployeeDashboardMobile() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const { attendance, celebrations, announcements, isLoading, isError, refetchAll: refetchDash } = useDashboard(month, false);

  function refetchAll() {
    refetchDash();
    void queryClient.invalidateQueries({ queryKey: queryKeys.todaySession() });
  }
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
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs font-medium">{format(new Date(month + "-01"), "MMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <AttendanceStatTiles
            tiles={att?.statTiles}
            holidays={att?.holidays}
            leaveBalances={att?.leaveBalances}
            month={month}
          />

          {(cel?.birthdays.length ?? 0) > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Birthdays</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-4">
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
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Anniversaries</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-4">
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
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-4">
                {ann.announcements.slice(0, 2).map((a) => (
                  <div key={a._id} className="p-3 rounded-xl bg-primary-tint">
                    {a.imageFileId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${a.imageFileId}`} alt="" className="mb-2 h-16 w-full rounded-md object-cover" />
                    ) : null}
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </QueryBoundary>
    </div>
  );
}

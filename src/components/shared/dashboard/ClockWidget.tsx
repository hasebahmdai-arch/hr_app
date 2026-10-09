"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePunchAction, useTodaySession, type PunchAction } from "@/hooks/use-timesheets";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TodaySessionResponse } from "@/types/api";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useLiveTimers(session: TodaySessionResponse | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!session?.checkInAt) {
    return { workSeconds: 0, breakSeconds: 0 };
  }

  const checkInMs = new Date(session.checkInAt).getTime();
  const checkOutMs = session.checkOutAt ? new Date(session.checkOutAt).getTime() : now;
  // Work timer runs continuously from check-in (includes time spent on break).
  const workSeconds = Math.max(Math.floor((checkOutMs - checkInMs) / 1000), 0);
  const breakBaseSeconds = session.breakTotalMinutes * 60;

  let breakSeconds = breakBaseSeconds;
  if (session.state === "on_break" && session.activeBreakStartedAt) {
    const activeMs = now - new Date(session.activeBreakStartedAt).getTime();
    breakSeconds = breakBaseSeconds + Math.max(Math.floor(activeMs / 1000), 0);
  }

  return { workSeconds, breakSeconds };
}

export function ClockWidget() {
  const { data: session, isLoading, isError, refetch } = useTodaySession();
  const punch = usePunchAction();
  const { workSeconds, breakSeconds } = useLiveTimers(session);
  const [clock, setClock] = useState(format(new Date(), "HH:mm:ss"));
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), "HH:mm:ss")), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleAction(action: PunchAction) {
    await punch.mutateAsync({ action });
    if (action === "check_out") setConfirmCheckOutOpen(false);
  }

  const state = session?.state ?? "not_started";
  const busy = punch.isPending;
  const isCompleted = state === "completed";

  return (
    <Card className="border-0 shadow-elevated overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">Today&apos;s Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
            {/* Actions + session metrics (left) */}
            <div className="space-y-5 order-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary-tint p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Time</p>
                  <p className="text-2xl font-bold text-primary tabular-nums mt-1">{formatDuration(workSeconds)}</p>
                </div>
                <div className="rounded-xl bg-muted-bg p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Break</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{formatDuration(breakSeconds)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {session?.shiftStart && session?.shiftEnd && (
                  <span>Shift: {session.shiftStart} – {session.shiftEnd}</span>
                )}
                {session?.checkInDisplay && <span>· In: {session.checkInDisplay}</span>}
                {session?.checkOutDisplay && <span>· Out: {session.checkOutDisplay}</span>}
              </div>

              {state === "on_break" && (
                <p className="text-sm font-medium text-warning">On break — work timer still running</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className={cn("min-h-[48px] bg-success hover:bg-success/90", isCompleted && "opacity-40")}
                  disabled={busy || state !== "not_started"}
                  onClick={() => handleAction("check_in")}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "Check In"}
                </Button>
                <Button
                  variant="outline"
                  className={cn("min-h-[48px] border-primary text-primary hover:bg-primary-tint", isCompleted && "opacity-40")}
                  disabled={busy || state !== "working"}
                  onClick={() => handleAction("break_start")}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "Start Break"}
                </Button>
                <Button
                  variant="outline"
                  className={cn("min-h-[48px]", isCompleted && "opacity-40")}
                  disabled={busy || state !== "on_break"}
                  onClick={() => handleAction("break_end")}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "End Break"}
                </Button>
                <Button
                  variant="destructive"
                  className={cn("min-h-[48px]", isCompleted && "opacity-40")}
                  disabled={busy || (state !== "working" && state !== "on_break")}
                  onClick={() => setConfirmCheckOutOpen(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              </div>

              {state === "completed" && (
                <p className="text-sm text-success font-medium">You&apos;ve completed today&apos;s attendance.</p>
              )}
            </div>

            {/* Wall clock (right) — visual only, not punch actions */}
            <div className="order-2 flex flex-col items-center justify-center rounded-xl bg-muted-bg/60 border border-border/50 p-6 md:p-8 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current time</p>
              <p className="text-4xl md:text-5xl font-bold tracking-tight text-primary tabular-nums">{clock}</p>
              <p className="text-sm text-muted-foreground mt-3">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>

          <Dialog open={confirmCheckOutOpen} onOpenChange={setConfirmCheckOutOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Check out?</DialogTitle>
                <DialogDescription>
                  You have worked {formatDuration(workSeconds)} today (break: {formatDuration(breakSeconds)}). End your shift now?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setConfirmCheckOutOpen(false)}>Cancel</Button>
                <Button variant="destructive" disabled={busy} onClick={() => handleAction("check_out")}>
                  {busy ? "Checking out..." : "Check Out"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

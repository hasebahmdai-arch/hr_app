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

  if (!session) {
    return { workSeconds: 0, breakSeconds: 0, businessSeconds: 0 };
  }

  const breakBaseSeconds = session.breakTotalMinutes * 60;
  let breakSeconds = breakBaseSeconds;
  if (session.state === "on_break" && session.activeBreakStartedAt) {
    const activeMs = now - new Date(session.activeBreakStartedAt).getTime();
    breakSeconds = breakBaseSeconds + Math.max(Math.floor(activeMs / 1000), 0);
  }

  // Server net minutes (includes open session up to last fetch); tick while working only
  let businessSeconds = Math.max(session.workedMinutesSoFar, 0) * 60;
  if (session.state === "working") {
    // Approx live: refetch interval covers accuracy; add seconds since last whole minute via wall clock from open session
    const open = [...(session.sessions ?? [])].reverse().find((s) => s.checkIn && !s.checkOut);
    if (open?.checkIn) {
      const closedNetSec = (session.sessions ?? [])
        .filter((s) => s.checkOut)
        .reduce((acc, s) => {
          const gross = Math.floor((new Date(s.checkOut!).getTime() - new Date(s.checkIn).getTime()) / 1000);
          const brk = (s.breaks ?? []).reduce((b, x) => {
            if (!x.endedAt) return b;
            return b + Math.max(Math.floor((new Date(x.endedAt).getTime() - new Date(x.startedAt).getTime()) / 1000), 0);
          }, 0);
          return acc + Math.max(gross - brk, 0);
        }, 0);
      const openGross = Math.max(Math.floor((now - new Date(open.checkIn).getTime()) / 1000), 0);
      const openBreak = (open.breaks ?? []).reduce((b, x) => {
        const end = x.endedAt ? new Date(x.endedAt).getTime() : now;
        return b + Math.max(Math.floor((end - new Date(x.startedAt).getTime()) / 1000), 0);
      }, 0);
      businessSeconds = closedNetSec + Math.max(openGross - openBreak, 0);
    }
  } else if (session.state === "on_break") {
    const open = [...(session.sessions ?? [])].reverse().find((s) => s.checkIn && !s.checkOut);
    if (open?.checkIn) {
      const closedNetSec = (session.sessions ?? [])
        .filter((s) => s.checkOut)
        .reduce((acc, s) => {
          const gross = Math.floor((new Date(s.checkOut!).getTime() - new Date(s.checkIn).getTime()) / 1000);
          const brk = (s.breaks ?? []).reduce((b, x) => {
            if (!x.endedAt) return b;
            return b + Math.max(Math.floor((new Date(x.endedAt).getTime() - new Date(x.startedAt).getTime()) / 1000), 0);
          }, 0);
          return acc + Math.max(gross - brk, 0);
        }, 0);
      const openGross = Math.max(Math.floor((now - new Date(open.checkIn).getTime()) / 1000), 0);
      const openBreak = (open.breaks ?? []).reduce((b, x) => {
        const end = x.endedAt ? new Date(x.endedAt).getTime() : now;
        return b + Math.max(Math.floor((end - new Date(x.startedAt).getTime()) / 1000), 0);
      }, 0);
      businessSeconds = closedNetSec + Math.max(openGross - openBreak, 0);
    }
  }

  return { workSeconds: businessSeconds, breakSeconds, businessSeconds };
}

export function ClockWidget() {
  const { data: session, isLoading, isError, refetch } = useTodaySession();
  const punch = usePunchAction();
  const { workSeconds, breakSeconds, businessSeconds } = useLiveTimers(session);
  const [clock, setClock] = useState(format(new Date(), "h:mm:ss a"));
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), "h:mm:ss a")), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleAction(action: PunchAction) {
    await punch.mutateAsync({ action });
    if (action === "check_out") setConfirmCheckOutOpen(false);
  }

  const state = session?.state ?? "not_started";
  const busy = punch.isPending;
  const canCheckIn = state === "not_started" || state === "idle";

  return (
    <Card className="border-0 shadow-elevated overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">Today&apos;s Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
            <div className="space-y-5 order-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary-tint p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Time</p>
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
                <p className="text-sm font-medium text-warning">On break — business time pauses</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className={cn("min-h-[48px] bg-success hover:bg-success/90", !canCheckIn && "opacity-40")}
                  disabled={busy || !canCheckIn}
                  onClick={() => handleAction("check_in")}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "Check In"}
                </Button>
                <Button
                  variant="outline"
                  className={cn("min-h-[48px] border-primary text-primary hover:bg-primary-tint")}
                  disabled={busy || state !== "working"}
                  onClick={() => handleAction("break_start")}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "Start Break"}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  disabled={busy || state !== "on_break"}
                  onClick={() => handleAction("break_end")}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {busy ? "Saving..." : "End Break"}
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-[48px]"
                  disabled={busy || (state !== "working" && state !== "on_break")}
                  onClick={() => setConfirmCheckOutOpen(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              </div>

              {state === "idle" && (
                <p className="text-sm text-success font-medium">Checked out — you can check in again.</p>
              )}
            </div>

            <div className="order-2 flex flex-col items-center justify-center rounded-xl bg-muted-bg/60 border border-border/50 p-6 md:p-8 text-center gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current time</p>
                <p className="text-4xl md:text-5xl font-bold tracking-tight text-primary tabular-nums">{clock}</p>
                <p className="text-sm text-muted-foreground mt-3">
                  {format(new Date(), "EEEE, MMMM d, yyyy")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {session?.isLate ? (
                  <div className="rounded-lg bg-background/80 p-3 text-center border border-border/40">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Late check-in</p>
                    <p className="text-sm font-semibold mt-1 text-warning">Yes</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg bg-background/80 p-3 text-center border border-border/40">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Check-in</p>
                      <p className="text-sm font-semibold mt-1">
                        {session?.checkInDisplay ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-3 text-center border border-border/40">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Break time</p>
                      <p className="text-sm font-semibold mt-1 tabular-nums">{formatDuration(breakSeconds)}</p>
                    </div>
                  </>
                )}
                <div className="rounded-lg bg-background/80 p-3 text-center border border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Work hours</p>
                  <p className="text-sm font-semibold mt-1 tabular-nums text-primary">{formatDuration(businessSeconds)}</p>
                </div>
              </div>
            </div>
          </div>

          <Dialog open={confirmCheckOutOpen} onOpenChange={setConfirmCheckOutOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Check out?</DialogTitle>
                <DialogDescription>
                  Business time today: {formatDuration(businessSeconds)} (break: {formatDuration(breakSeconds)}). End this session now?
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

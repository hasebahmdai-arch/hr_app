"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Cake, Coffee, LogIn, LogOut, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { CelebrationsResponse, TodaySessionResponse, TodayWorkSession } from "@/types/api";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sessionBreakSeconds(sessions: TodayWorkSession[] | undefined, nowMs: number) {
  let total = 0;
  for (const s of sessions ?? []) {
    for (const b of s.breaks ?? []) {
      const start = new Date(b.startedAt).getTime();
      const end = b.endedAt ? new Date(b.endedAt).getTime() : nowMs;
      total += Math.max(Math.floor((end - start) / 1000), 0);
    }
  }
  return total;
}

function sessionWorkSeconds(sessions: TodayWorkSession[] | undefined, nowMs: number) {
  let total = 0;
  for (const s of sessions ?? []) {
    if (!s.checkIn) continue;
    const checkIn = new Date(s.checkIn).getTime();
    const checkOut = s.checkOut ? new Date(s.checkOut).getTime() : nowMs;
    const gross = Math.max(Math.floor((checkOut - checkIn) / 1000), 0);
    let brk = 0;
    for (const b of s.breaks ?? []) {
      const start = new Date(b.startedAt).getTime();
      const end = b.endedAt ? new Date(b.endedAt).getTime() : nowMs;
      brk += Math.max(Math.floor((end - start) / 1000), 0);
    }
    total += Math.max(gross - brk, 0);
  }
  return total;
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

  const breakSeconds = sessionBreakSeconds(session.sessions, now);
  const businessSeconds = sessionWorkSeconds(session.sessions, now);

  return { workSeconds: businessSeconds, breakSeconds, businessSeconds };
}

export function ClockWidget() {
  const { data: auth } = useSession();
  const isHR = auth?.user?.role === "hr";
  const { data: session, isLoading, isError, refetch } = useTodaySession();
  const punch = usePunchAction();
  const { workSeconds, breakSeconds, businessSeconds } = useLiveTimers(session);
  const [clock, setClock] = useState(format(new Date(), "h:mm:ss a"));
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);

  const { data: celebrations } = useQuery({
    queryKey: queryKeys.dashboard.celebrations(),
    queryFn: () => fetcher<CelebrationsResponse>("/api/dashboard/celebrations"),
    enabled: isHR,
  });

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
  const punchAction = punch.variables?.action;
  const canCheckIn = state === "not_started" || state === "idle";
  const loadingAction = (a: PunchAction) => busy && punchAction === a;

  const celebrationLines: string[] = [];
  if (isHR && celebrations) {
    for (const b of celebrations.birthdays.slice(0, 4)) {
      celebrationLines.push(`🎂 ${b.firstName} ${b.lastName} — ${b.date}`);
    }
    for (const a of celebrations.anniversaries.slice(0, 4)) {
      celebrationLines.push(`🎉 ${a.firstName} ${a.lastName} — ${a.milestone}y · ${a.date}`);
    }
  }

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
                <LoadingButton
                  className={cn("min-h-[48px] bg-success hover:bg-success/90", !canCheckIn && "opacity-40")}
                  loading={loadingAction("check_in")}
                  disabled={busy || !canCheckIn}
                  onClick={() => handleAction("check_in")}
                >
                  {!loadingAction("check_in") && <LogIn className="h-4 w-4 mr-2" />}
                  Check In
                </LoadingButton>
                <LoadingButton
                  variant="outline"
                  className={cn("min-h-[48px] border-primary text-primary hover:bg-primary-tint")}
                  loading={loadingAction("break_start")}
                  disabled={busy || state !== "working"}
                  onClick={() => handleAction("break_start")}
                >
                  {!loadingAction("break_start") && <Coffee className="h-4 w-4 mr-2" />}
                  Start Break
                </LoadingButton>
                <LoadingButton
                  variant="outline"
                  className="min-h-[48px]"
                  loading={loadingAction("break_end")}
                  disabled={busy || state !== "on_break"}
                  onClick={() => handleAction("break_end")}
                >
                  {!loadingAction("break_end") && <Play className="h-4 w-4 mr-2" />}
                  End Break
                </LoadingButton>
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

              {isHR && (
                <div className="w-full max-w-sm rounded-lg bg-background/80 p-4 text-left border border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Cake className="h-3 w-3" /> Celebrations
                  </p>
                  {celebrationLines.length ? (
                    <ul className="space-y-1">
                      {celebrationLines.slice(0, 5).map((line) => (
                        <li key={line} className="text-xs text-foreground truncate">{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No upcoming celebrations</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="rounded-lg bg-background/80 p-4 text-center border border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Check-in</p>
                  <p className="text-sm font-semibold">
                    {session?.checkInDisplay ?? "—"}
                    {session?.isLate ? (
                      <span className="ml-1 text-[10px] font-medium text-warning align-middle">Late</span>
                    ) : null}
                  </p>
                </div>
                <div className="rounded-lg bg-background/80 p-4 text-center border border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Break time</p>
                  <p className="text-sm font-semibold tabular-nums">{formatDuration(breakSeconds)}</p>
                </div>
                <div className="rounded-lg bg-background/80 p-4 text-center border border-border/40 col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Work hours</p>
                  <p className="text-sm font-semibold tabular-nums text-primary">{formatDuration(businessSeconds)}</p>
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
                <Button variant="outline" onClick={() => setConfirmCheckOutOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <LoadingButton
                  variant="destructive"
                  loading={loadingAction("check_out")}
                  disabled={busy && punchAction !== "check_out"}
                  onClick={() => handleAction("check_out")}
                >
                  Check Out
                </LoadingButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

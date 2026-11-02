"use client";

import {
  CalendarDays,
  CalendarOff,
  Clock,
  LogOut,
  Percent,
  Plane,
  Sun,
  UserCheck,
  UserX,
} from "lucide-react";
import type { AttendanceStatTiles as StatTiles } from "@/types/api";
import { KpiCard } from "@/components/shared/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TILES: {
  key: keyof StatTiles;
  label: string;
  accent?: "primary" | "success" | "warning";
  icon: React.ReactNode;
}[] = [
  { key: "absents", label: "Absents", accent: "warning", icon: <UserX className="h-5 w-5" /> },
  { key: "late", label: "Late", accent: "warning", icon: <Clock className="h-5 w-5" /> },
  { key: "missedCheckouts", label: "Missed checkouts", icon: <LogOut className="h-5 w-5" /> },
  { key: "weekendWork", label: "Weekend work", icon: <Sun className="h-5 w-5" /> },
  { key: "holidayWork", label: "Holiday work", icon: <CalendarOff className="h-5 w-5" /> },
  { key: "present", label: "Present", accent: "success", icon: <UserCheck className="h-5 w-5" /> },
  { key: "onLeave", label: "On leave", icon: <Plane className="h-5 w-5" /> },
  { key: "attendancePct", label: "Attendance %", accent: "primary", icon: <Percent className="h-5 w-5" /> },
];

type LeaveBalance = {
  leaveType: string;
  year: number;
  entitled: number;
  used: number;
  remaining: number;
};

export function AttendanceStatTiles({
  tiles,
  holidays,
  leaveBalances,
  showMonthHeading = true,
}: {
  tiles?: StatTiles | null;
  holidays?: { date: string; name: string }[];
  leaveBalances?: LeaveBalance[];
  showMonthHeading?: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {showMonthHeading && <h2 className="text-base font-semibold">This month</h2>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TILES.map(({ key, label, accent, icon }) => (
            <KpiCard
              key={key}
              label={label}
              value={
                key === "attendancePct"
                  ? `${tiles?.[key] ?? 0}%`
                  : (tiles?.[key] ?? 0)
              }
              accent={accent}
              icon={icon}
            />
          ))}
        </div>
      </section>

      {leaveBalances && leaveBalances.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Leaves</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leaveBalances.map((b) => (
              <Card key={b.leaveType} className="overflow-hidden shadow-card">
                <div className="h-1 bg-primary" />
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {b.leaveType}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-2">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted-bg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Entitled</p>
                      <p className="text-xl font-bold">{b.entitled}</p>
                    </div>
                    <div className="rounded-lg bg-muted-bg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Used</p>
                      <p className="text-xl font-bold">{b.used}</p>
                    </div>
                    <div className="rounded-lg bg-primary-tint p-3">
                      <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                      <p className="text-xl font-bold text-primary">{b.remaining}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {holidays && holidays.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base">Holidays this month</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            <ul className="space-y-2">
              {holidays.map((h) => (
                <li
                  key={h.date}
                  className="text-sm text-muted-foreground flex justify-between gap-2 rounded-lg bg-muted-bg px-3 py-2"
                >
                  <span className="font-medium text-foreground">{h.name}</span>
                  <span className="tabular-nums">{h.date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

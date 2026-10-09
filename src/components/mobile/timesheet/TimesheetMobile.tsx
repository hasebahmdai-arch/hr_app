"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { useSession } from "next-auth/react";
import { useTimesheets } from "@/hooks/use-timesheets";
import { usePeople } from "@/hooks/use-people";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimesheetFilters } from "@/types/api";

type Preset = "7d" | "week" | "month" | "lastMonth" | "custom";

function rangeForPreset(preset: Preset, now = new Date()) {
  switch (preset) {
    case "7d":
      return {
        dateFrom: format(subDays(now, 6), "yyyy-MM-dd"),
        dateTo: format(now, "yyyy-MM-dd"),
      };
    case "week":
      return {
        dateFrom: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        dateTo: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
        dateTo: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "lastMonth": {
      const prev = subMonths(now, 1);
      return {
        dateFrom: format(startOfMonth(prev), "yyyy-MM-dd"),
        dateTo: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    default:
      return null;
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "custom", label: "Custom" },
];

export function TimesheetMobile() {
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";
  const now = useMemo(() => new Date(), []);
  const monthRange = rangeForPreset("month", now)!;
  const [preset, setPreset] = useState<Preset>("month");
  const [filters, setFilters] = useState<TimesheetFilters>({
    ...monthRange,
    page: 1,
    limit: 20,
  });
  const { data, isLoading, isError, refetch } = useTimesheets(filters);
  const { data: peopleData } = usePeople("", 1, false);

  function applyPreset(next: Preset) {
    setPreset(next);
    const range = rangeForPreset(next);
    if (range) {
      setFilters((f) => ({ ...f, ...range, page: 1 }));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Timesheet</h1>
      <p className="text-sm text-muted-foreground -mt-2">View punch records by date range</p>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            className="shrink-0"
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Card className="border-0 shadow-card">
        <CardContent className="pt-4 space-y-3">
          {isHR && (
            <div>
              <Label>Employee</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={filters.employeeId ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, employeeId: e.target.value || undefined, page: 1 }))
                }
              >
                <option value="">All employees</option>
                {peopleData?.items.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => {
                  setPreset("custom");
                  setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }));
                }}
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={filters.dateTo ?? ""}
                min={filters.dateFrom}
                onChange={(e) => {
                  setPreset("custom");
                  setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }));
                }}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value || undefined, page: 1 }))
              }
            >
              <option value="">All</option>
              {["P", "A", "M", "L", "W", "O", "T", "H"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-3">
          {data?.items.map((row) => (
            <Card key={row._id} className="border-0 shadow-card">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    {isHR && row.employee && (
                      <p className="text-sm font-medium">
                        {row.employee.firstName} {row.employee.lastName}
                      </p>
                    )}
                    <span className="font-medium">{row.date}</span>
                  </div>
                  <StatusBadge status={row.statusCode} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>In: {row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "—"}</div>
                  <div>Out: {row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "—"}</div>
                  <div>
                    Worked: {Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m
                  </div>
                  <div>Break: {row.breakMinutes}m</div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!data?.items.length && (
            <p className="text-center text-muted-foreground py-8">No records in this range</p>
          )}
        </div>
        {data && data.total > data.limit && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className={cn("text-sm self-center")}>
              Page {filters.page} of {Math.ceil(data.total / data.limit)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page ?? 1) >= Math.ceil(data.total / data.limit)}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

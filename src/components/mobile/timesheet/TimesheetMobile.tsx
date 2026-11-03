"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
  parse,
} from "date-fns";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { usePunchEvents, useTimesheets } from "@/hooks/use-timesheets";
import { usePeople } from "@/hooks/use-people";
import { useHrPersonAttendanceSummary } from "@/hooks/use-hr-dashboard";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar } from "@/components/shared/Avatar";
import { AttendanceStatTiles } from "@/components/shared/dashboard/AttendanceStatTiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimesheetFilters } from "@/types/api";
import type { Timesheet } from "@/types/domain";

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

function monthFromRange(dateFrom?: string) {
  if (dateFrom && /^\d{4}-\d{2}/.test(dateFrom)) return dateFrom.slice(0, 7);
  return format(new Date(), "yyyy-MM");
}

function MobileRowDetail({ row }: { row: Timesheet }) {
  const { data: events } = usePunchEvents({ date: row.date, employeeId: row.employeeId, limit: 50 });
  return (
    <div className="mt-3 pt-3 border-t space-y-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-1">
        {row.isLate && <span className="rounded bg-warning/15 text-warning px-2 py-0.5">Late</span>}
        {row.isAbsent && <span className="rounded bg-destructive/10 text-destructive px-2 py-0.5">Absent</span>}
        {row.isMissedCheckout && <span className="rounded bg-warning/15 text-warning px-2 py-0.5">Missed checkout</span>}
      </div>
      {(row.sessions ?? []).map((s, i) => (
        <p key={i}>
          Session {i + 1}: {s.checkInDisplay ?? "—"} → {s.checkOutDisplay ?? "open"}
        </p>
      ))}
      {events?.items?.map((e) => (
        <p key={e._id}>
          {e.atDisplay ?? format(new Date(e.at), "h:mm a")} — {e.action.replace(/_/g, " ")}
        </p>
      ))}
    </div>
  );
}

function HrPeopleTimesheetGrid({ month }: { month: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, refetch } = usePeople(query, 1, false, 100);
  const range = {
    dateFrom: format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd"),
    dateTo: format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd"),
  };

  function openPerson(id: string) {
    const params = new URLSearchParams({
      employeeId: id,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
    router.push(`/app/timesheet?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Timesheet</h1>
      <p className="text-sm text-muted-foreground -mt-2">Select a person to view their timesheet</p>

      <div>
        <Label>Month</Label>
        <Input
          type="month"
          value={month}
          onChange={(e) => {
            const next = e.target.value;
            if (!/^\d{4}-\d{2}$/.test(next)) return;
            const nextRange = {
              dateFrom: format(startOfMonth(parse(next, "yyyy-MM", new Date())), "yyyy-MM-dd"),
              dateTo: format(endOfMonth(parse(next, "yyyy-MM", new Date())), "yyyy-MM-dd"),
            };
            router.replace(
              `/app/timesheet?dateFrom=${nextRange.dateFrom}&dateTo=${nextRange.dateTo}`
            );
          }}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="pl-9"
        />
      </form>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-3">
          {data?.items.map((person) => (
            <button
              key={person._id}
              type="button"
              className="w-full text-left"
              onClick={() => openPerson(person._id)}
            >
              <Card className="border-0 shadow-card">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Avatar
                    firstName={person.firstName}
                    lastName={person.lastName}
                    fileId={person.avatarFileId}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{person.employeeCode}</p>
                    {person.department && (
                      <p className="text-xs text-primary truncate">{person.department.name}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
          {!data?.items.length && (
            <p className="text-center text-muted-foreground py-8">No people found</p>
          )}
        </div>
      </QueryBoundary>
    </div>
  );
}

export function TimesheetMobile() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isHR = session?.user?.role === "hr";
  const now = useMemo(() => new Date(), []);
  const monthRange = rangeForPreset("month", now)!;
  const employeeId = searchParams.get("employeeId") || undefined;
  const gridMonth = monthFromRange(searchParams.get("dateFrom") || monthRange.dateFrom);

  const initial = useMemo(() => {
    const dateFrom = searchParams.get("dateFrom") || monthRange.dateFrom;
    const dateTo = searchParams.get("dateTo") || monthRange.dateTo;
    return {
      dateFrom,
      dateTo,
      status: searchParams.get("status") || undefined,
      flag: searchParams.get("flag") || undefined,
      employeeId,
      page: 1,
      limit: 20,
    } satisfies TimesheetFilters;
  }, [searchParams, monthRange.dateFrom, monthRange.dateTo, employeeId]);

  const [preset, setPreset] = useState<Preset>(
    searchParams.get("dateFrom") || searchParams.get("flag") || searchParams.get("status")
      ? "custom"
      : "month"
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<TimesheetFilters>(initial);

  useEffect(() => {
    setFilters(initial);
    if (searchParams.get("status") || searchParams.get("flag")) {
      setPreset("custom");
    }
  }, [initial, searchParams]);

  const { data, isLoading, isError, refetch } = useTimesheets(filters);

  const summaryMonth = monthFromRange(filters.dateFrom);
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useHrPersonAttendanceSummary(isHR ? employeeId : undefined, summaryMonth);

  function applyPreset(next: Preset) {
    setPreset(next);
    const range = rangeForPreset(next);
    if (range) {
      setFilters((f) => ({ ...f, ...range, page: 1 }));
    }
  }

  if (isHR && !employeeId) {
    return <HrPeopleTimesheetGrid month={gridMonth} />;
  }

  const backHref = `/app/timesheet?dateFrom=${format(
    startOfMonth(parse(summaryMonth, "yyyy-MM", new Date())),
    "yyyy-MM-dd"
  )}&dateTo=${format(endOfMonth(parse(summaryMonth, "yyyy-MM", new Date())), "yyyy-MM-dd")}`;

  return (
    <div className="space-y-4">
      {isHR && employeeId ? (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to team
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">
            {summary ? `${summary.firstName} ${summary.lastName}` : "Timesheet"}
          </h1>
          {summary?.employeeCode && (
            <p className="text-sm text-muted-foreground -mt-1">Code {summary.employeeCode}</p>
          )}
        </div>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground -mt-2">View punch records by date range</p>
        </>
      )}

      {isHR && employeeId && (
        <QueryBoundary
          isLoading={summaryLoading}
          isError={summaryError}
          onRetry={() => refetchSummary()}
        >
          <AttendanceStatTiles
            tiles={summary?.statTiles}
            leaveBalances={summary?.leaveBalances}
            holidays={summary?.holidays}
            month={summaryMonth}
            employeeId={employeeId}
            showMonthHeading
          />
        </QueryBoundary>
      )}

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
                setFilters((f) => ({
                  ...f,
                  status: e.target.value || undefined,
                  flag: undefined,
                  page: 1,
                }))
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
          <div>
            <Label>Flag</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={filters.flag ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  flag: e.target.value || undefined,
                  status: undefined,
                  page: 1,
                }))
              }
            >
              <option value="">All</option>
              <option value="late">Late</option>
              <option value="missedCheckout">Missed checkout</option>
              <option value="weekendWork">Weekend work</option>
              <option value="holidayWork">Holiday work</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-3">
          {data?.items.map((row) => {
            const open = expanded === row._id;
            return (
              <Card key={row._id} className="border-0 shadow-card">
                <CardContent className="pt-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpanded(open ? null : row._id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{row.date}</span>
                      </div>
                      <StatusBadge status={row.statusCode} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        In:{" "}
                        {row.sessions?.[0]?.checkInDisplay ??
                          (row.checkIn ? format(new Date(row.checkIn), "h:mm a") : "—")}
                      </div>
                      <div>
                        Out:{" "}
                        {([...((row.sessions ?? []) as { checkOutDisplay?: string }[])]
                          .reverse()
                          .find((s) => s.checkOutDisplay)?.checkOutDisplay) ??
                          (row.checkOut ? format(new Date(row.checkOut), "h:mm a") : "—")}
                      </div>
                      <div>
                        Business: {Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m
                      </div>
                      <div>Break: {row.breakMinutes}m</div>
                    </div>
                  </button>
                  {open && <MobileRowDetail row={row} />}
                </CardContent>
              </Card>
            );
          })}
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

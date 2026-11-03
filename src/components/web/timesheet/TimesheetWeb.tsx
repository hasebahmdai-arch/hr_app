"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { usePunchEvents, useTimesheets } from "@/hooks/use-timesheets";
import { usePeople } from "@/hooks/use-people";
import { useHrPersonAttendanceSummary } from "@/hooks/use-hr-dashboard";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar } from "@/components/shared/Avatar";
import { AttendanceStatTiles } from "@/components/shared/dashboard/AttendanceStatTiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimesheetFilters } from "@/types/api";
import type { Timesheet } from "@/types/domain";
import { cn } from "@/lib/utils";

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
  { id: "7d", label: "Last 7 days" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
];

function FlagChip({ label, active, tone }: { label: string; active?: boolean; tone?: "warn" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        active
          ? tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

function TimesheetRowDetail({ row }: { row: Timesheet }) {
  const { data: events } = usePunchEvents({ date: row.date, employeeId: row.employeeId, limit: 50 });
  const sessions = row.sessions ?? [];

  return (
    <div className="bg-muted-bg/40 px-4 py-3 space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <FlagChip label={row.isLate ? "Late" : "On time"} active={row.isLate} tone="warn" />
        <FlagChip label={row.isAbsent ? "Absent" : "Present"} active={row.isAbsent} tone="danger" />
        <FlagChip label={row.isMissedCheckout ? "Missed checkout" : "Checkout OK"} active={row.isMissedCheckout} tone="warn" />
      </div>

      {sessions.length > 0 && (
        <div>
          <p className="font-medium mb-1">Sessions</p>
          <ul className="space-y-1">
            {sessions.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                Session {i + 1}: {s.checkInDisplay ?? "—"} → {s.checkOutDisplay ?? "open"}
                {(s.breaks?.length ?? 0) > 0 && (
                  <span className="ml-2">
                    ({s.breaks.length} break{s.breaks.length === 1 ? "" : "s"})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="font-medium mb-1">Punch log</p>
        {events?.items?.length ? (
          <ul className="space-y-1">
            {events.items.map((e) => (
              <li key={e._id} className="text-muted-foreground">
                {e.atDisplay ?? format(new Date(e.at), "h:mm a")} — {e.action.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No punch events recorded</p>
        )}
      </div>
    </div>
  );
}

function filtersFromSearchParams(params: URLSearchParams, now = new Date()): TimesheetFilters {
  const monthDefault = rangeForPreset("month", now)!;
  const dateFrom = params.get("dateFrom") || monthDefault.dateFrom;
  const dateTo = params.get("dateTo") || monthDefault.dateTo;
  const status = params.get("status") || undefined;
  const flag = params.get("flag") || undefined;
  const employeeId = params.get("employeeId") || undefined;
  return {
    dateFrom,
    dateTo,
    status,
    flag,
    employeeId,
    page: 1,
    limit: 20,
  };
}

function monthFromRange(dateFrom?: string) {
  if (dateFrom && /^\d{4}-\d{2}/.test(dateFrom)) return dateFrom.slice(0, 7);
  return format(new Date(), "yyyy-MM");
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
    <div className="space-y-6">
      <PageHeader title="Timesheet" subtitle="Select a person to view their timesheet" />
      <div className="flex flex-wrap gap-4 items-end">
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
            className="w-[160px]"
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
          className="relative flex-1 min-w-[200px] max-w-md"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, email..."
            className="pl-9"
          />
        </form>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.items.map((person) => (
            <button
              key={person._id}
              type="button"
              onClick={() => openPerson(person._id)}
              className="text-left"
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-6 flex items-center gap-4">
                  <Avatar
                    firstName={person.firstName}
                    lastName={person.lastName}
                    fileId={person.avatarFileId}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {person.employeeCode}
                    </p>
                    {person.department && (
                      <p className="text-xs text-primary truncate">{person.department.name}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
        {!data?.items.length && (
          <p className="text-center text-muted-foreground py-12">No people found</p>
        )}
      </QueryBoundary>
    </div>
  );
}

function TimesheetTable({
  filters,
  setFilters,
  preset,
  setPreset,
  showEmployeeColumn,
}: {
  filters: TimesheetFilters;
  setFilters: React.Dispatch<React.SetStateAction<TimesheetFilters>>;
  preset: Preset;
  setPreset: (p: Preset) => void;
  showEmployeeColumn: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useTimesheets(filters);

  function applyPreset(next: Preset) {
    setPreset(next);
    const range = rangeForPreset(next);
    if (range) setFilters((f) => ({ ...f, ...range, page: 1 }));
  }

  return (
    <>
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={preset === p.id ? "default" : "outline"}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
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
            <div>
              <Label>Status</Label>
              <select
                className="h-10 rounded-md border px-3 text-sm"
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
                className="h-10 rounded-md border px-3 text-sm"
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
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="border rounded-xl overflow-hidden bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg">
              <tr>
                <th className="w-8 p-3" />
                {showEmployeeColumn && <th className="text-left p-3 font-medium">Employee</th>}
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Check In</th>
                <th className="text-left p-3 font-medium">Check Out</th>
                <th className="text-left p-3 font-medium">Business</th>
                <th className="text-left p-3 font-medium">Break</th>
                <th className="text-left p-3 font-medium">Flags</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((row) => {
                const open = expanded === row._id;
                return (
                  <Fragment key={row._id}>
                    <tr className="border-t even:bg-muted-bg/30">
                      <td className="p-2">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted"
                          onClick={() => setExpanded(open ? null : row._id)}
                          aria-label="Toggle details"
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      {showEmployeeColumn && (
                        <td className="p-3">
                          {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : "—"}
                        </td>
                      )}
                      <td className="p-3">{row.date}</td>
                      <td className="p-3">
                        {row.sessions?.[0]?.checkInDisplay ??
                          (row.checkIn ? format(new Date(row.checkIn), "h:mm a") : "—")}
                      </td>
                      <td className="p-3">
                        {([...((row.sessions ?? []) as { checkOutDisplay?: string }[])]
                          .reverse()
                          .find((s) => s.checkOutDisplay)?.checkOutDisplay) ??
                          (row.checkOut ? format(new Date(row.checkOut), "h:mm a") : "—")}
                      </td>
                      <td className="p-3">
                        {Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m
                      </td>
                      <td className="p-3">{row.breakMinutes}m</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.isLate && <FlagChip label="Late" active tone="warn" />}
                          {row.isAbsent && <FlagChip label="Absent" active tone="danger" />}
                          {row.isMissedCheckout && <FlagChip label="Missed out" active tone="warn" />}
                          {!row.isLate && !row.isAbsent && !row.isMissedCheckout && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={row.statusCode} />
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t">
                        <td colSpan={showEmployeeColumn ? 9 : 8} className="p-0">
                          <TimesheetRowDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!data?.items.length && (
                <tr>
                  <td colSpan={showEmployeeColumn ? 9 : 8} className="p-8 text-center text-muted-foreground">
                    No records in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > data.limit && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm self-center">
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
    </>
  );
}

export function TimesheetWeb() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isHR = session?.user?.role === "hr";
  const now = useMemo(() => new Date(), []);
  const initial = useMemo(() => filtersFromSearchParams(searchParams, now), [searchParams, now]);
  const employeeId = searchParams.get("employeeId") || undefined;
  const gridMonth = monthFromRange(searchParams.get("dateFrom") || initial.dateFrom);

  const [preset, setPreset] = useState<Preset>(
    searchParams.get("dateFrom") ||
      searchParams.get("dateTo") ||
      searchParams.get("status") ||
      searchParams.get("flag")
      ? "custom"
      : "month"
  );
  const [filters, setFilters] = useState<TimesheetFilters>(initial);

  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams, now));
    if (
      searchParams.get("status") ||
      searchParams.get("flag") ||
      (searchParams.get("dateFrom") && searchParams.get("dateFrom") !== rangeForPreset("month", now)?.dateFrom)
    ) {
      setPreset("custom");
    }
  }, [searchParams, now]);

  const summaryMonth = monthFromRange(filters.dateFrom);
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useHrPersonAttendanceSummary(isHR ? employeeId : undefined, summaryMonth);

  if (isHR && !employeeId) {
    return <HrPeopleTimesheetGrid month={gridMonth} />;
  }

  const backHref = `/app/timesheet?dateFrom=${format(
    startOfMonth(parse(summaryMonth, "yyyy-MM", new Date())),
    "yyyy-MM-dd"
  )}&dateTo=${format(endOfMonth(parse(summaryMonth, "yyyy-MM", new Date())), "yyyy-MM-dd")}`;

  const personName = summary
    ? `${summary.firstName} ${summary.lastName}`
    : filters.employeeId
      ? "Employee"
      : null;

  return (
    <div className="space-y-6">
      {isHR && employeeId ? (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to team
            </Link>
          </Button>
          <PageHeader
            title={personName ?? "Timesheet"}
            subtitle={summary?.employeeCode ? `Code ${summary.employeeCode}` : "Person timesheet"}
          />
        </div>
      ) : (
        <PageHeader title="Timesheet" subtitle="Punch records by custom date range" />
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

      <TimesheetTable
        filters={filters}
        setFilters={setFilters}
        preset={preset}
        setPreset={setPreset}
        showEmployeeColumn={!!isHR && !employeeId}
      />
    </div>
  );
}

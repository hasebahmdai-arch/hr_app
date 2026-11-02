"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { PaginatedResponse, PunchEventItem, TimesheetFilters, TodaySessionResponse } from "@/types/api";
import type { Timesheet } from "@/types/domain";

export type PunchAction = "check_in" | "check_out" | "break_start" | "break_end";

export function useTimesheets(filters: TimesheetFilters) {
  return useQuery({
    queryKey: queryKeys.timesheets(filters),
    queryFn: () =>
      fetcher<PaginatedResponse<Timesheet>>(`/api/timesheets${buildQuery(filters as Record<string, string | number | undefined>)}`),
  });
}

export function usePunchEvents(filters: { date?: string; employeeId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.punchEvents(filters as Record<string, string | undefined>),
    queryFn: () =>
      fetcher<PaginatedResponse<PunchEventItem>>(
        `/api/timesheets/punch-events${buildQuery(filters as Record<string, string | number | undefined>)}`
      ),
    enabled,
  });
}

export function useTodaySession() {
  return useQuery({
    queryKey: queryKeys.todaySession(),
    queryFn: () => fetcher<TodaySessionResponse>("/api/timesheets/today"),
    refetchInterval: 30_000,
  });
}

export function usePunchAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { action: PunchAction; lat?: number; lng?: number }) =>
      fetcher<{ action: string; session: TodaySessionResponse }>("/api/timesheets/punch", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.todaySession() });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: ["punch-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

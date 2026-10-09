"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { PaginatedResponse, TimesheetFilters, TodaySessionResponse } from "@/types/api";
import type { Timesheet } from "@/types/domain";

export type PunchAction = "check_in" | "check_out" | "break_start" | "break_end";

export function useTimesheets(filters: TimesheetFilters) {
  return useQuery({
    queryKey: queryKeys.timesheets(filters),
    queryFn: () =>
      fetcher<PaginatedResponse<Timesheet>>(`/api/timesheets${buildQuery(filters as Record<string, string | number | undefined>)}`),
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
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

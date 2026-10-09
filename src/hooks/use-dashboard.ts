"use client";

import { useQueries } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type {
  AnnouncementsResponse,
  CelebrationsResponse,
  DashboardAttendanceResponse,
  PendingApprovalsResponse,
} from "@/types/api";

export function useDashboard(month: string, isHR: boolean) {
  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.dashboard.attendance(month),
        queryFn: () => fetcher<DashboardAttendanceResponse>(`/api/dashboard/attendance?month=${month}`),
        refetchOnWindowFocus: true,
        refetchInterval: 60_000,
      },
      {
        queryKey: queryKeys.dashboard.celebrations(),
        queryFn: () => fetcher<CelebrationsResponse>("/api/dashboard/celebrations"),
      },
      {
        queryKey: queryKeys.dashboard.announcements(),
        queryFn: () => fetcher<AnnouncementsResponse>("/api/dashboard/announcements"),
      },
      {
        queryKey: queryKeys.dashboard.pendingApprovals(),
        queryFn: () => fetcher<PendingApprovalsResponse>("/api/dashboard/pending-approvals"),
        enabled: isHR,
      },
    ],
  });

  return {
    attendance: results[0],
    celebrations: results[1],
    announcements: results[2],
    pendingApprovals: results[3],
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    refetchAll: () => results.forEach((r) => r.refetch()),
  };
}

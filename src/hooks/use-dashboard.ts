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
        refetchIntervalInBackground: false,
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

  const active = results.filter((_, i) => i !== 3 || isHR);

  return {
    attendance: results[0],
    celebrations: results[1],
    announcements: results[2],
    pendingApprovals: results[3],
    isLoading: active.some((r) => r.isLoading),
    isError: active.some((r) => r.isError),
    refetchAll: () => {
      results.forEach((r, i) => {
        if (i === 3 && !isHR) return;
        void r.refetch();
      });
    },
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { HrAttendanceReport, HrDashboardOverview, HrRequestsSummary } from "@/types/api";

export function useHrDashboard(month: string, departmentId?: string) {
  const overview = useQuery({
    queryKey: [...queryKeys.hrDashboard.overview(), month],
    queryFn: () => fetcher<HrDashboardOverview>(`/api/hr/dashboard/overview?month=${month}`),
  });

  const attendance = useQuery({
    queryKey: queryKeys.hrDashboard.attendance(month, departmentId),
    queryFn: () => {
      const params = new URLSearchParams({ month });
      if (departmentId) params.set("departmentId", departmentId);
      return fetcher<HrAttendanceReport>(`/api/hr/dashboard/attendance?${params}`);
    },
  });

  const requests = useQuery({
    queryKey: queryKeys.hrDashboard.requests(10),
    queryFn: () => fetcher<HrRequestsSummary>("/api/hr/dashboard/requests?limit=10"),
  });

  const refetchAll = () => {
    overview.refetch();
    attendance.refetch();
    requests.refetch();
  };

  return {
    overview,
    attendance,
    requests,
    isLoading: overview.isLoading || attendance.isLoading || requests.isLoading,
    isError: overview.isError || attendance.isError || requests.isError,
    refetchAll,
  };
}

export function downloadHrReport(type: "attendance" | "requests" | "employees", month: string, departmentId?: string) {
  const params = new URLSearchParams({ type, month });
  if (departmentId) params.set("departmentId", departmentId);
  window.open(`/api/hr/reports/export?${params}`, "_blank");
}

export function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

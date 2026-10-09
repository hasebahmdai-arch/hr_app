"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { RequestType } from "@/lib/constants";
import type { PaginatedResponse } from "@/types/api";
import type { BaseRequest } from "@/types/domain";

export function useRequests(type: RequestType, status: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.requests(type, status, page),
    queryFn: () =>
      fetcher<PaginatedResponse<BaseRequest>>(
        `/api/requests/${type}${buildQuery({ status: status === "ALL" ? undefined : status, page })}`
      ),
  });
}

export function useCreateRequest(type: RequestType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher<BaseRequest>(`/api/requests/${type}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: queryKeys.todaySession() });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: queryKeys.hrDashboard.attendance("") });
    },
  });
}

export function useRequestAction(type: RequestType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "request_cancel" | "cancel" }) =>
      fetcher(`/api/requests/${type}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: queryKeys.todaySession() });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: queryKeys.hrDashboard.attendance("") });
    },
  });
}

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
    refetchOnMount: true,
  });
}

async function invalidateAfterRequestChange(
  qc: ReturnType<typeof useQueryClient>,
  type: RequestType
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["requests", type], refetchType: "all" }),
    qc.invalidateQueries({ queryKey: ["request-inbox"], refetchType: "all" }),
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
    qc.invalidateQueries({ queryKey: queryKeys.notifications() }),
    qc.invalidateQueries({ queryKey: queryKeys.todaySession() }),
    qc.invalidateQueries({ queryKey: ["timesheets"] }),
    qc.invalidateQueries({ queryKey: ["hr-dashboard"] }),
    qc.invalidateQueries({ queryKey: queryKeys.leaveBalancesMe() }),
  ]);
}

export function useCreateRequest(type: RequestType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher<BaseRequest>(`/api/requests/${type}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await invalidateAfterRequestChange(qc, type);
    },
  });
}

export function useRequestAction(type: RequestType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      fields,
    }: {
      id: string;
      action: "approve" | "reject" | "request_cancel" | "cancel" | "update";
      fields?: Record<string, unknown>;
    }) =>
      fetcher(`/api/requests/${type}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, fields }),
      }),
    onSuccess: async () => {
      await invalidateAfterRequestChange(qc, type);
    },
  });
}

export type ApproveAllResult = {
  approved: number;
  failed: number;
  results: Array<{
    _id: string;
    type: RequestType;
    requestCode?: string;
    ok: boolean;
    error?: string;
    status?: string;
  }>;
};

/** Approve all PENDING/CANCELING requests. Pass type to scope to one kind; omit for all. */
export function useApproveAllRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { type?: RequestType }) =>
      fetcher<ApproveAllResult>("/api/requests/approve-all", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: async (_data, vars) => {
      if (vars?.type) {
        await invalidateAfterRequestChange(qc, vars.type);
      } else {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["requests"], refetchType: "all" }),
          qc.invalidateQueries({ queryKey: ["request-inbox"], refetchType: "all" }),
          qc.invalidateQueries({ queryKey: ["dashboard"] }),
          qc.invalidateQueries({ queryKey: queryKeys.notifications() }),
          qc.invalidateQueries({ queryKey: queryKeys.todaySession() }),
          qc.invalidateQueries({ queryKey: ["timesheets"] }),
          qc.invalidateQueries({ queryKey: ["hr-dashboard"] }),
          qc.invalidateQueries({ queryKey: queryKeys.leaveBalancesMe() }),
        ]);
      }
    },
  });
}

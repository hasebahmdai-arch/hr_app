"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { notificationTypeToRequestType } from "@/lib/notification-utils";
import { queryKeys } from "@/lib/query-keys";
import type { PaginatedResponse } from "@/types/api";
import type { Notification } from "@/types/domain";
import type { RequestType } from "@/lib/constants";

export function useNotifications(page = 1, unreadOnly = false) {
  return useQuery({
    queryKey: [...queryKeys.notifications(), page, unreadOnly],
    queryFn: () =>
      fetcher<PaginatedResponse<Notification>>(
        `/api/notifications${buildQuery({ page, limit: 20, unread: unreadOnly ? "true" : undefined })}`
      ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids?: string[]; markAllRead?: boolean; typePrefix?: string }) =>
      fetcher("/api/notifications", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
    },
  });
}

export function useUnreadNotificationsByType() {
  const { data } = useNotifications(1, true);
  const byType: Partial<Record<RequestType, number>> = {};
  let total = 0;
  let requestUnreadTotal = 0;
  for (const n of data?.items ?? []) {
    const reqType = notificationTypeToRequestType(n.type);
    if (reqType) {
      byType[reqType] = (byType[reqType] ?? 0) + 1;
      requestUnreadTotal++;
    }
    total++;
  }
  if (data && data.total > (data.items?.length ?? 0)) {
    total = data.total;
  }
  return { byType, total, requestUnreadTotal };
}

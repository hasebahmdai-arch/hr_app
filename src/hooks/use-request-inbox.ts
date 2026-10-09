"use client";

import { useQuery } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { InboxRow } from "@/lib/request-inbox";

interface InboxResponse {
  items: InboxRow[];
  total: number;
  page: number;
  limit: number;
}

export function useRequestInbox(status: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.requestInbox(status, page),
    queryFn: () =>
      fetcher<InboxResponse>(
        `/api/requests/inbox${buildQuery({ status, page, limit: 20 })}`
      ),
  });
}

export function useRequestAttentionCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.requestInboxCount(),
    queryFn: () => fetcher<{ count: number }>("/api/requests/inbox/count"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled,
  });
}

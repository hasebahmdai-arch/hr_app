"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { ProfileResponse } from "@/types/api";
import type { Employee } from "@/types/domain";

export function useProfile(employeeId?: string) {
  const { data: session, status } = useSession();
  const selfId = session?.user?.id;
  const isSelf = !employeeId;
  // Self: use /api/dashboard/me (static route under a known-working prefix).
  // Others: /api/employees/:id (HR).
  const ready = isSelf ? status === "authenticated" && !!selfId : !!employeeId;

  return useQuery({
    queryKey: queryKeys.profile(isSelf ? "self" : employeeId),
    queryFn: () =>
      fetcher<ProfileResponse>(
        isSelf ? "/api/dashboard/me" : `/api/employees/${employeeId}`
      ),
    enabled: ready,
  });
}

export function useUpdateProfile(employeeId?: string) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const resolvedId = employeeId || session?.user?.id;

  return useMutation({
    mutationFn: (body: Partial<Employee>) => {
      if (!resolvedId) throw new Error("Not signed in");
      return fetcher<Employee>(`/api/employees/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile(employeeId ? employeeId : "self") });
      qc.invalidateQueries({ queryKey: queryKeys.profile() });
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

export function useCreateEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fileId: string; title: string; type?: string }) =>
      fetcher(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile(employeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile("self") });
      qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      fetcher(`/api/employees/${employeeId}/documents?documentId=${documentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile(employeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile("self") });
      qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

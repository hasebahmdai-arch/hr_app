"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { ProfileResponse } from "@/types/api";
import type { Employee } from "@/types/domain";

export function useProfile(employeeId?: string) {
  const isMe = !employeeId;
  return useQuery({
    queryKey: queryKeys.profile(employeeId),
    queryFn: () =>
      fetcher<ProfileResponse>(isMe ? "/api/employees/me" : `/api/employees/${employeeId}`),
  });
}

export function useUpdateProfile(employeeId?: string) {
  const qc = useQueryClient();
  const isMe = !employeeId;
  return useMutation({
    mutationFn: (body: Partial<Employee>) =>
      fetcher<Employee>(isMe ? "/api/employees/me" : `/api/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile(employeeId) });
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
      qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

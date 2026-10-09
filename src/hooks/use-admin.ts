"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

export interface Shift {
  _id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  timezone?: string;
  isActive?: boolean;
}

export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.admin.departments(),
    queryFn: () => fetcher<Department[]>("/api/admin/departments"),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Department, "_id">) =>
      fetcher<Department>("/api/admin/departments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.departments() }),
  });
}

export function useShifts() {
  return useQuery({
    queryKey: queryKeys.admin.shifts(),
    queryFn: () => fetcher<Shift[]>("/api/admin/shifts"),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Shift, "_id">) =>
      fetcher<Shift>("/api/admin/shifts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.shifts() }),
  });
}

export function useAdminDocuments() {
  return useQuery({
    queryKey: queryKeys.admin.documents(),
    queryFn: () =>
      fetcher<{
        companyDocuments?: { _id: string; title: string; fileId?: string; category?: string }[];
        announcements?: { _id: string; title: string; body: string; type?: string }[];
      }>("/api/admin/documents"),
  });
}

export function useCreateAdminDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher("/api/admin/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.documents() }),
  });
}

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

export function useAdminDocuments(type: "all" | "documents" | "announcements" = "all") {
  return useQuery({
    queryKey: queryKeys.admin.documents(type),
    queryFn: () =>
      fetcher<{
        companyDocuments?: { _id: string; title: string; fileId?: string; category?: string }[];
        announcements?: { _id: string; title: string; body: string; type?: string }[];
      }>(`/api/admin/documents?type=${type}`),
  });
}

export function useCreateAdminDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher("/api/admin/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "documents"] }),
  });
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  isActive?: boolean;
}

export function useHolidaysAdmin() {
  return useQuery({
    queryKey: queryKeys.admin.holidays(),
    queryFn: () => fetcher<Holiday[]>("/api/admin/holidays"),
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Holiday, "_id">) =>
      fetcher<Holiday>("/api/admin/holidays", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.holidays() });
      qc.invalidateQueries({ queryKey: ["holidays"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/admin/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.holidays() });
      qc.invalidateQueries({ queryKey: ["holidays"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
  });
}

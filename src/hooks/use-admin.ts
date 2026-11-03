"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, fetcher } from "@/lib/fetcher";
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

async function deleteRequest(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", body.code, res.status);
  }
  if (res.status !== 204) {
    await res.json().catch(() => null);
  }
}

function invalidateAdminDocuments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "documents"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.announcements() });
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

export function useUpdateDepartment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<Department, "_id">>) =>
      fetcher<Department>(`/api/admin/departments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.departments() }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRequest(`/api/admin/departments/${id}`),
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

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<Shift, "_id">> & { id: string }) =>
      fetcher<Shift>(`/api/admin/shifts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.shifts() }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRequest(`/api/admin/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.shifts() }),
  });
}

export function useAdminDocuments(type: "all" | "documents" | "announcements" = "all") {
  return useQuery({
    queryKey: queryKeys.admin.documents(type),
    queryFn: () =>
      fetcher<{
        companyDocuments?: { _id: string; title: string; fileId?: string; category?: string }[];
        announcements?: { _id: string; title: string; body: string; type?: string; imageFileId?: string }[];
      }>(`/api/admin/documents?type=${type}`),
  });
}

export function useCreateAdminDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher("/api/admin/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateAdminDocuments(qc),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; body?: string; imageFileId?: string; type?: string }) =>
      fetcher(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAdminDocuments(qc),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAdminDocuments(qc),
  });
}

export function useUpdateCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      category?: string;
      fileId?: string;
      thumbnailFileId?: string;
    }) =>
      fetcher(`/api/admin/company-documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAdminDocuments(qc),
  });
}

export function useDeleteCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/admin/company-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAdminDocuments(qc),
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

function invalidateHolidays(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.admin.holidays() });
  qc.invalidateQueries({ queryKey: ["holidays"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Holiday, "_id">) =>
      fetcher<Holiday>("/api/admin/holidays", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateHolidays(qc),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<Holiday, "_id">> & { id: string }) =>
      fetcher<Holiday>(`/api/admin/holidays/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateHolidays(qc),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/admin/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateHolidays(qc),
  });
}

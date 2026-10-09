"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import type { Employee } from "@/types/domain";

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  role: "employee" | "hr";
  designation?: string;
  departmentId?: string;
  shiftId?: string;
  hireDate: string;
  dateOfBirth: string;
}

export interface CreateEmployeeResponse {
  employee: Employee;
  inviteSent?: boolean;
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEmployeeInput) =>
      fetcher<CreateEmployeeResponse>("/api/employees", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

export function useResendEmployeeInvite(employeeId: string) {
  return useMutation({
    mutationFn: () =>
      fetcher<{ message: string }>(`/api/employees/${employeeId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) =>
      fetcher<{ deleted: boolean }>(`/api/employees/${employeeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

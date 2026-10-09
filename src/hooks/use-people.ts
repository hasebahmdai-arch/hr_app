"use client";

import { useQuery } from "@tanstack/react-query";
import { buildQuery, fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import type { PaginatedResponse } from "@/types/api";
import type { Employee } from "@/types/domain";

export interface PeopleItem extends Pick<Employee, "firstName" | "lastName" | "employeeCode" | "email" | "designation" | "avatarFileId" | "hireDate" | "accountActive" | "role"> {
  _id: string;
  department?: { _id: string; name: string };
}

export function usePeople(search?: string, page = 1, includeInactive = false) {
  return useQuery({
    queryKey: [...queryKeys.people(search), page, includeInactive],
    queryFn: () =>
      fetcher<PaginatedResponse<PeopleItem>>(
        `/api/people${buildQuery({ search, page, includeInactive: includeInactive || undefined })}`
      ),
  });
}

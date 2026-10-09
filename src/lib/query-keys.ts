import type { TimesheetFilters } from "@/types/api";

export const queryKeys = {
  dashboard: {
    attendance: (month: string) => ["dashboard", "attendance", month] as const,
    celebrations: () => ["dashboard", "celebrations"] as const,
    announcements: () => ["dashboard", "announcements"] as const,
    pendingApprovals: () => ["dashboard", "pending-approvals"] as const,
  },
  todaySession: () => ["timesheets", "today"] as const,
  hrDashboard: {
    overview: () => ["hr-dashboard", "overview"] as const,
    attendance: (month: string, departmentId?: string) =>
      ["hr-dashboard", "attendance", month, departmentId ?? ""] as const,
    requests: (limit: number) => ["hr-dashboard", "requests", limit] as const,
  },
  timesheets: (filters: TimesheetFilters) => ["timesheets", filters] as const,
  requests: (type: string, status: string, page: number) => ["requests", type, status, page] as const,
  requestInbox: (status: string, page: number) => ["request-inbox", status, page] as const,
  requestInboxCount: () => ["request-inbox", "count"] as const,
  profile: (employeeId?: string) => ["profile", employeeId ?? "me"] as const,
  notifications: () => ["notifications"] as const,
  people: (search?: string) => ["people", search ?? ""] as const,
  admin: {
    departments: () => ["admin", "departments"] as const,
    shifts: () => ["admin", "shifts"] as const,
    documents: () => ["admin", "documents"] as const,
  },
};

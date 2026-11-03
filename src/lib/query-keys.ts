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
    personAttendance: (id: string, month: string) =>
      ["hr-dashboard", "person-attendance", id, month] as const,
  },
  timesheets: (filters: TimesheetFilters) => ["timesheets", filters] as const,
  punchEvents: (filters: Record<string, string | undefined>) => ["punch-events", filters] as const,
  requests: (type: string, status: string, page: number) => ["requests", type, status, page] as const,
  requestInbox: (status: string, page: number) => ["request-inbox", status, page] as const,
  requestInboxCount: () => ["request-inbox", "count"] as const,
  profile: (employeeId?: string) => ["profile", employeeId ?? "self"] as const,
  notifications: () => ["notifications"] as const,
  people: (search?: string) => ["people", search ?? ""] as const,
  admin: {
    departments: () => ["admin", "departments"] as const,
    shifts: () => ["admin", "shifts"] as const,
    holidays: () => ["admin", "holidays"] as const,
    documents: (type?: string) => ["admin", "documents", type ?? "all"] as const,
  },
  holidays: (from?: string, to?: string) => ["holidays", from ?? "", to ?? ""] as const,
  leaveBalancesMe: () => ["leave-balances", "me"] as const,
};

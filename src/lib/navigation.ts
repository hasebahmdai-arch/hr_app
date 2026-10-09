import { REQUEST_TYPES, type RequestType } from "@/lib/constants";

export const REQUEST_LABELS: Record<RequestType, string> = {
  punch: "Punch",
  expense: "Expense",
  leave: "Leave",
  loans: "Loans",
  wfh: "Work From Home",
  "official-duty": "Official Duty",
  relaxation: "Relaxation",
  travel: "Travel",
};

export const WEB_NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/app/people", label: "People", icon: "Users" },
  { href: "/app/timesheet", label: "Timesheet", icon: "Clock" },
  {
    href: "/app/requests",
    label: "Requests",
    icon: "FileText",
    children: REQUEST_TYPES.map((t) => ({
      href: `/app/requests/${t}`,
      label: REQUEST_LABELS[t],
    })),
  },
] as const;

export const MOBILE_NAV: {
  href: string;
  label: string;
  icon: string;
  isFab?: boolean;
  /** If set, only show for this role (omit = everyone). */
  roles?: Array<"employee" | "hr">;
}[] = [
  { href: "/app/dashboard", label: "Home", icon: "LayoutDashboard" },
  { href: "/app/timesheet", label: "Timesheet", icon: "ClipboardList" },
  { href: "/app/requests", label: "Requests", icon: "Plus", isFab: true },
  { href: "/app/people", label: "People", icon: "Users", roles: ["hr"] },
  { href: "/app/requests/leave", label: "Leave", icon: "CalendarDays", roles: ["employee"] },
  { href: "/app/profile", label: "Profile", icon: "User" },
] as const;

export const ADMIN_NAV = [
  { href: "/app/admin/departments", label: "Departments" },
  { href: "/app/admin/shifts", label: "Shifts" },
  { href: "/app/admin/documents", label: "Documents" },
] as const;

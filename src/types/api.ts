export interface TimesheetFilters {
  status?: string;
  manualFlag?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  checkInFrom?: string;
  checkInTo?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardAttendanceResponse {
  month: string;
  attendancePct: number;
  shiftMetrics: {
    totalShifts: number;
    expectedMinutes: number;
    workedMinutes: number;
    shortMinutes: number;
    shiftWorkedMinutes: number;
    breakMinutes: number;
  };
  statusCounters: Record<string, number>;
  anomalyCounters: Record<string, number>;
  trends: { date: string; checkInMinutes: number | null }[];
  todayRecord?: {
    checkIn?: string;
    checkOut?: string;
    checkInDisplay?: string;
    checkOutDisplay?: string;
    shiftStart?: string;
    shiftEnd?: string;
  };
}

export type TodaySessionState = "not_started" | "working" | "on_break" | "completed";

export interface TodaySessionResponse {
  state: TodaySessionState;
  checkInAt?: string;
  checkOutAt?: string;
  checkInDisplay?: string;
  checkOutDisplay?: string;
  shiftStart?: string;
  shiftEnd?: string;
  breakTotalMinutes: number;
  activeBreakStartedAt?: string;
  workedMinutesSoFar: number;
  expectedMinutes: number;
}

export interface HrDashboardOverview {
  totalEmployees: number;
  presentToday: number;
  onBreakToday: number;
  pendingApprovals: number;
  avgAttendancePct: number;
}

export interface HrEmployeeAttendanceRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department?: string;
  daysPresent: number;
  attendancePct: number;
  lateCount: number;
  statusToday: string;
}

export interface HrAttendanceReport {
  month: string;
  departmentAggregates: { departmentId: string; name: string; attendancePct: number; employeeCount: number }[];
  employees: HrEmployeeAttendanceRow[];
  dailyPresentTrend: { date: string; present: number }[];
}

export interface HrRequestQueueItem {
  _id: string;
  requestCode: string;
  type: string;
  status: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
}

export interface HrRequestsSummary {
  byStatus: Record<string, number>;
  recent: HrRequestQueueItem[];
}

export interface CelebrationsResponse {
  birthdays: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    avatarFileId?: string;
    date: string;
  }[];
  anniversaries: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    avatarFileId?: string;
    milestone: number;
    date: string;
  }[];
}

export interface AnnouncementsResponse {
  companyDocuments: {
    _id: string;
    title: string;
    fileId: string;
    category: string;
  }[];
  announcements: {
    _id: string;
    title: string;
    body: string;
    imageFileId?: string;
    type: string;
  }[];
}

export interface PendingApprovalsResponse {
  count: number;
  byType: Record<string, number>;
}

export interface ProfileResponse {
  employee: import("./domain").Employee;
  assets: unknown[];
  documents: unknown[];
  departments: { _id: string; name: string }[];
  shifts: { _id: string; name: string; startTime: string; endTime: string }[];
  managers: { _id: string; firstName: string; lastName: string }[];
  notificationPreferences?: {
    emailEnabled: boolean;
    prefs: Record<string, boolean>;
  };
}

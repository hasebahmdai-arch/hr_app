export interface TimesheetFilters {
  status?: string;
  flag?: string;
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

export interface AttendanceStatTiles {
  absents: number;
  late: number;
  missedCheckouts: number;
  weekendWork: number;
  holidayWork: number;
  present: number;
  onLeave: number;
  wfhDays: number;
  attendancePct: number;
}

export interface HrPersonAttendanceSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  statTiles: AttendanceStatTiles;
  leaveBalances: {
    leaveType: string;
    year: number;
    entitled: number;
    used: number;
    remaining: number;
  }[];
  holidays: { date: string; name: string }[];
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
  statTiles: AttendanceStatTiles;
  holidays: { date: string; name: string }[];
  leaveBalances?: {
    leaveType: string;
    year: number;
    entitled: number;
    used: number;
    remaining: number;
  }[];
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

export type TodaySessionState = "not_started" | "working" | "on_break" | "idle";

export interface TodaySessionBreak {
  startedAt: string;
  endedAt?: string;
  startedDisplay?: string;
  endedDisplay?: string;
}

export interface TodayWorkSession {
  checkIn: string;
  checkOut?: string;
  checkInDisplay?: string;
  checkOutDisplay?: string;
  breaks: TodaySessionBreak[];
}

export interface TodaySessionResponse {
  state: TodaySessionState;
  checkInAt?: string;
  checkOutAt?: string;
  checkInDisplay?: string;
  checkOutDisplay?: string;
  shiftStart?: string;
  shiftEnd?: string;
  breakTotalSeconds: number;
  breakTotalMinutes: number;
  activeBreakStartedAt?: string;
  workedSecondsSoFar: number;
  workedMinutesSoFar: number;
  expectedMinutes: number;
  checkinStatus?: string;
  checkoutStatus?: string;
  isAbsent?: boolean;
  isLate?: boolean;
  isMissedCheckout?: boolean;
  sessions?: TodayWorkSession[];
}

export interface PunchEventItem {
  _id: string;
  employeeId: string;
  timesheetId?: string;
  date: string;
  action: string;
  at: string;
  atDisplay?: string;
}

export interface HrDashboardOverview {
  totalEmployees: number;
  presentToday: number;
  onBreakToday: number;
  pendingApprovals: number;
  avgAttendancePct: number;
  statTiles: AttendanceStatTiles;
  holidays: { date: string; name: string }[];
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
  leaveBalances?: {
    leaveType: string;
    year: number;
    entitled: number;
    used: number;
    remaining: number;
  }[];
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

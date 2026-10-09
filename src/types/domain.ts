export type UserRole = "employee" | "hr";

export interface PersonalInfo {
  dateOfBirth?: string;
  nationalId?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
}

export interface ContactInfo {
  currentAddress?: string;
  permanentAddress?: string;
  personalPhone?: string;
}

export interface Qualification {
  degree: string;
  institution: string;
  year?: number;
}

export interface Relative {
  name: string;
  relationship: string;
  phone?: string;
  isDependent?: boolean;
}

export interface BankInfo {
  bankName?: string;
  iban?: string;
  branchCode?: string;
}

export interface Employee {
  _id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatarFileId?: string;
  designation?: string;
  departmentId?: string;
  shiftId?: string;
  managerId?: string;
  profileCompletionPct: number;
  hireDate?: string;
  accountActive: boolean;
  personalInfo?: PersonalInfo;
  employmentInfo?: Record<string, unknown>;
  contactInfo?: ContactInfo;
  qualifications?: Qualification[];
  relatives?: Relative[];
  banks?: BankInfo;
}

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface Timesheet {
  _id: string;
  employeeId: string;
  date: string;
  shiftId?: string;
  checkIn?: string;
  checkOut?: string;
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  checkinStatus?: string;
  checkoutStatus?: string;
  workedMinutes: number;
  expectedMinutes: number;
  shortMinutes: number;
  breakMinutes: number;
  breaks?: { startedAt: string; endedAt?: string }[];
  statusCode: string;
  source: string;
  employee?: Pick<Employee, "firstName" | "lastName" | "employeeCode">;
}

export interface BaseRequest {
  _id: string;
  requestCode: string;
  employeeId: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  employee?: Pick<Employee, "firstName" | "lastName" | "employeeCode">;
}

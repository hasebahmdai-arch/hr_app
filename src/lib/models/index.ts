import mongoose, { Schema, models, model } from "mongoose";
import { REQUEST_STATUSES } from "@/lib/constants";

const requestStatusEnum = { type: String, enum: REQUEST_STATUSES, default: "PENDING" };

export const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ShiftSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMinutes: { type: Number, default: 60 },
    timezone: { type: String, default: process.env.COMPANY_TIMEZONE || "Asia/Karachi" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmployeeSchema = new Schema(
  {
    employeeCode: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["employee", "hr"], default: "employee" },
    avatarFileId: Schema.Types.ObjectId,
    designation: String,
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" },
    profileCompletionPct: { type: Number, default: 0 },
    hireDate: Date,
    accountActive: { type: Boolean, default: true },
    personalInfo: {
      dateOfBirth: String,
      nationalId: String,
      gender: String,
      bloodGroup: String,
      phone: String,
    },
    employmentInfo: Schema.Types.Mixed,
    contactInfo: {
      currentAddress: String,
      permanentAddress: String,
      personalPhone: String,
    },
    qualifications: [{ degree: String, institution: String, year: Number }],
    relatives: [{ name: String, relationship: String, phone: String, isDependent: Boolean }],
    banks: { bankName: String, iban: String, branchCode: String },
  },
  { timestamps: true }
);

export const TimesheetSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift" },
    checkIn: Date,
    checkOut: Date,
    checkInLocation: { lat: Number, lng: Number },
    checkOutLocation: { lat: Number, lng: Number },
    checkinStatus: String,
    checkoutStatus: String,
    workedMinutes: { type: Number, default: 0 },
    expectedMinutes: { type: Number, default: 480 },
    shortMinutes: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    breaks: [{ startedAt: Date, endedAt: Date }],
    statusCode: { type: String, default: "P" },
    source: { type: String, enum: ["manual", "punch", "import"], default: "punch" },
  },
  { timestamps: true }
);
TimesheetSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const baseRequestFields = {
  requestCode: { type: String, required: true, unique: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  status: requestStatusEnum,
  reviewedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
  reviewedAt: Date,
  effectAppliedAt: Date,
  effectSnapshot: Schema.Types.Mixed,
};

export const PunchRequestSchema = new Schema(
  { ...baseRequestFields, punchType: String, requestedTimestamp: Date, reason: String },
  { timestamps: true }
);
export const LeaveRequestSchema = new Schema(
  { ...baseRequestFields, leaveType: String, startDate: Date, endDate: Date, reason: String },
  { timestamps: true }
);
export const ExpenseRequestSchema = new Schema(
  { ...baseRequestFields, amount: Number, category: String, receiptFileIds: [Schema.Types.ObjectId] },
  { timestamps: true }
);
export const LoanRequestSchema = new Schema(
  { ...baseRequestFields, amount: Number, purpose: String, repaymentPlan: String },
  { timestamps: true }
);
export const WfhRequestSchema = new Schema(
  { ...baseRequestFields, dates: [Date], reason: String },
  { timestamps: true }
);
export const OfficialDutyRequestSchema = new Schema(
  { ...baseRequestFields, location: String, dates: [Date] },
  { timestamps: true }
);
export const RelaxationRequestSchema = new Schema(
  { ...baseRequestFields, date: Date, type: String, minutes: Number },
  { timestamps: true }
);
export const TravelRequestSchema = new Schema(
  { ...baseRequestFields, destination: String, dates: [Date], purpose: String },
  { timestamps: true }
);

[PunchRequestSchema, LeaveRequestSchema, ExpenseRequestSchema, LoanRequestSchema, WfhRequestSchema, OfficialDutyRequestSchema, RelaxationRequestSchema, TravelRequestSchema].forEach((s) => {
  s.index({ employeeId: 1, status: 1 });
  s.index({ status: 1, createdAt: -1 });
});

export const AssetSchema = new Schema(
  { employeeId: { type: Schema.Types.ObjectId, ref: "Employee" }, assetName: String, serialNumber: String, assignedDate: Date, status: { type: String, default: "ASSIGNED" } },
  { timestamps: true }
);

export const FileMetadataSchema = new Schema(
  {
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    bucket: { type: String, required: true },
    filename: String,
    mimeType: String,
    sizeBytes: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    entityType: String,
    entityId: Schema.Types.ObjectId,
  },
  { timestamps: true }
);
FileMetadataSchema.index({ employeeId: 1 });
FileMetadataSchema.index({ bucket: 1, entityType: 1, entityId: 1 });

export const DocumentSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    fileId: { type: Schema.Types.ObjectId, ref: "FileMetadata" },
    title: String,
    type: String,
    signedAt: Date,
  },
  { timestamps: true }
);

export const CompanyDocumentSchema = new Schema(
  { title: String, fileId: { type: Schema.Types.ObjectId, ref: "FileMetadata" }, thumbnailFileId: Schema.Types.ObjectId, category: String },
  { timestamps: true }
);

export const AnnouncementSchema = new Schema(
  { title: String, body: String, imageFileId: Schema.Types.ObjectId, type: String, publishedAt: Date, createdBy: { type: Schema.Types.ObjectId, ref: "Employee" } },
  { timestamps: true }
);

export const NotificationSchema = new Schema(
  { userId: { type: Schema.Types.ObjectId, ref: "Employee" }, title: String, body: String, type: String, href: String, read: { type: Boolean, default: false }, emailSent: { type: Boolean, default: false } },
  { timestamps: true }
);
NotificationSchema.index({ userId: 1, read: 1 });

export const NotificationPreferenceSchema = new Schema(
  { employeeId: { type: Schema.Types.ObjectId, ref: "Employee", unique: true }, emailEnabled: { type: Boolean, default: true }, prefs: Schema.Types.Mixed },
  { timestamps: true }
);

export const EmailLogSchema = new Schema(
  { recipientEmail: String, type: String, subject: String, status: String, error: String, sentAt: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const PasswordResetTokenSchema = new Schema(
  { employeeId: { type: Schema.Types.ObjectId, ref: "Employee" }, tokenHash: String, expiresAt: Date, usedAt: Date },
  { timestamps: true }
);
PasswordResetTokenSchema.index({ tokenHash: 1 });
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuditLogSchema = new Schema(
  { entityType: String, entityId: Schema.Types.ObjectId, actorId: { type: Schema.Types.ObjectId, ref: "Employee" }, action: String, previousStatus: String, newStatus: String, timestamp: { type: Date, default: Date.now } },
  { timestamps: true }
);

export const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

export const Department = models.Department || model("Department", DepartmentSchema);
export const Shift = models.Shift || model("Shift", ShiftSchema);
export const Employee = models.Employee || model("Employee", EmployeeSchema);
export const Timesheet = models.Timesheet || model("Timesheet", TimesheetSchema);
export const PunchRequest = models.PunchRequest || model("PunchRequest", PunchRequestSchema);
export const LeaveRequest = models.LeaveRequest || model("LeaveRequest", LeaveRequestSchema);
export const ExpenseRequest = models.ExpenseRequest || model("ExpenseRequest", ExpenseRequestSchema);
export const LoanRequest = models.LoanRequest || model("LoanRequest", LoanRequestSchema);
export const WfhRequest = models.WfhRequest || model("WfhRequest", WfhRequestSchema);
export const OfficialDutyRequest = models.OfficialDutyRequest || model("OfficialDutyRequest", OfficialDutyRequestSchema);
export const RelaxationRequest = models.RelaxationRequest || model("RelaxationRequest", RelaxationRequestSchema);
export const TravelRequest = models.TravelRequest || model("TravelRequest", TravelRequestSchema);
export const Asset = models.Asset || model("Asset", AssetSchema);
export const FileMetadata = models.FileMetadata || model("FileMetadata", FileMetadataSchema);
export const Document = models.Document || model("Document", DocumentSchema);
export const CompanyDocument = models.CompanyDocument || model("CompanyDocument", CompanyDocumentSchema);
export const Announcement = models.Announcement || model("Announcement", AnnouncementSchema);
export const Notification = models.Notification || model("Notification", NotificationSchema);
export const NotificationPreference = models.NotificationPreference || model("NotificationPreference", NotificationPreferenceSchema);
export const EmailLog = models.EmailLog || model("EmailLog", EmailLogSchema);
export const PasswordResetToken = models.PasswordResetToken || model("PasswordResetToken", PasswordResetTokenSchema);
export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export const Counter = models.Counter || model("Counter", CounterSchema);

export const REQUEST_MODELS: Record<string, mongoose.Model<unknown>> = {
  punch: PunchRequest,
  expense: ExpenseRequest,
  leave: LeaveRequest,
  loans: LoanRequest,
  wfh: WfhRequest,
  "official-duty": OfficialDutyRequest,
  relaxation: RelaxationRequest,
  travel: TravelRequest,
};

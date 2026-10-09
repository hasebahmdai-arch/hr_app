import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import {
  Asset,
  Department,
  Document,
  Employee,
  Notification,
  NotificationPreference,
  PasswordResetToken,
  REQUEST_MODELS,
  Shift,
  Timesheet,
  FileMetadata,
} from "@/lib/models";
import { generateEmployeeCode } from "@/lib/employee-code";
import { calculateProfileCompletion } from "@/lib/profile-utils";
import { deleteFileMetadata } from "@/lib/files";
import type { ProfileResponse } from "@/types/api";

export function serializeEmployee(emp: Record<string, unknown>) {
  const rest = { ...emp };
  delete rest.passwordHash;
  return {
    ...rest,
    _id: (rest._id as { toString(): string }).toString(),
    departmentId: (rest.departmentId as { toString?: () => string })?.toString?.(),
    shiftId: (rest.shiftId as { toString?: () => string })?.toString?.(),
    managerId: (rest.managerId as { toString?: () => string })?.toString?.(),
    avatarFileId: (rest.avatarFileId as { toString?: () => string })?.toString?.(),
    hireDate: rest.hireDate ? new Date(rest.hireDate as string).toISOString() : undefined,
  };
}

export async function countActiveHR(excludeId?: string) {
  await connectDB();
  const filter: Record<string, unknown> = { role: "hr", accountActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return Employee.countDocuments(filter);
}

export async function assertHrSafeguards(
  employeeId: string,
  updates: Record<string, unknown>,
  actorId?: string
) {
  await connectDB();
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error("NOT_FOUND");

  if (updates.accountActive === false) {
    if (actorId && employeeId === actorId) {
      throw new Error("CANNOT_DEACTIVATE_SELF");
    }
    if (employee.role === "hr") {
      const remaining = await countActiveHR(employeeId);
      if (remaining === 0) throw new Error("LAST_HR");
    }
  }

  if (updates.role === "employee" && employee.role === "hr") {
    const remaining = await countActiveHR(employeeId);
    if (remaining === 0) throw new Error("LAST_HR");
  }
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  role: "employee" | "hr";
  /** Only for bootstrap/setup — HR create never passes a password. */
  password?: string;
  designation?: string;
  departmentId?: string;
  shiftId?: string;
  hireDate?: string;
  dateOfBirth?: string;
}

export async function createEmployee(input: CreateEmployeeInput) {
  await connectDB();

  const existing = await Employee.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new Error("EMAIL_EXISTS");

  if (input.departmentId) {
    const dept = await Department.findOne({ _id: input.departmentId, isActive: true });
    if (!dept) throw new Error("INVALID_DEPARTMENT");
  }
  if (input.shiftId) {
    const shift = await Shift.findOne({ _id: input.shiftId, isActive: true });
    if (!shift) throw new Error("INVALID_SHIFT");
  }

  const plainPassword = input.password || randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const employeeCode = await generateEmployeeCode();

  const employee = await Employee.create({
    employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    passwordHash,
    role: input.role,
    designation: input.designation,
    departmentId: input.departmentId || undefined,
    shiftId: input.shiftId || undefined,
    hireDate: input.hireDate ? new Date(input.hireDate) : new Date(),
    personalInfo: input.dateOfBirth ? { dateOfBirth: input.dateOfBirth } : {},
    accountActive: true,
  });

  employee.profileCompletionPct = calculateProfileCompletion(employee.toObject());
  await employee.save();

  await NotificationPreference.create({ employeeId: employee._id, emailEnabled: true, prefs: {} });

  return {
    employee,
    /** True when HR should email an invite link (no password provided). */
    needsInvite: !input.password,
  };
}

export async function buildProfileResponse(employeeId: string): Promise<ProfileResponse> {
  await connectDB();
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new Error("NOT_FOUND");

  const [assets, documents, departments, shifts, managers, prefs] = await Promise.all([
    Asset.find({ employeeId }).lean(),
    Document.find({ employeeId }).populate("fileId").lean(),
    Department.find({ isActive: true }).select("name").lean(),
    Shift.find({ isActive: true }).select("name startTime endTime").lean(),
    Employee.find({ role: "hr", accountActive: true }).select("firstName lastName").lean(),
    NotificationPreference.findOne({ employeeId }).lean(),
  ]);

  return {
    employee: serializeEmployee(employee) as ProfileResponse["employee"],
    assets: assets.map((a) => ({ ...a, _id: a._id.toString(), employeeId: a.employeeId?.toString() })),
    documents: documents.map((d) => ({
      _id: d._id.toString(),
      employeeId: d.employeeId?.toString(),
      title: (d as { title?: string }).title,
      type: (d as { type?: string }).type,
      fileId: (d.fileId as { _id?: { toString(): string } })?._id?.toString() ?? d.fileId?.toString(),
    })),
    departments: departments.map((d) => ({ _id: d._id.toString(), name: d.name })),
    shifts: shifts.map((s) => ({
      _id: s._id.toString(),
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    managers: managers.map((m) => ({
      _id: m._id.toString(),
      firstName: m.firstName,
      lastName: m.lastName,
    })),
    notificationPreferences: prefs
      ? { emailEnabled: prefs.emailEnabled, prefs: (prefs.prefs as Record<string, boolean>) || {} }
      : undefined,
  };
}

export async function updateEmployeeProfile(
  employeeId: string,
  updates: Record<string, unknown>,
  actorId?: string
) {
  await connectDB();
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error("NOT_FOUND");

  await assertHrSafeguards(employeeId, updates, actorId);

  if (updates.email !== undefined) {
    const email = (updates.email as string).toLowerCase();
    const duplicate = await Employee.findOne({ email, _id: { $ne: employeeId } });
    if (duplicate) throw new Error("EMAIL_EXISTS");
    employee.email = email;
  }

  const allowedFields = [
    "firstName",
    "lastName",
    "role",
    "designation",
    "departmentId",
    "shiftId",
    "managerId",
    "hireDate",
    "accountActive",
    "personalInfo",
    "contactInfo",
    "qualifications",
    "relatives",
    "banks",
    "employmentInfo",
    "avatarFileId",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      (employee as Record<string, unknown>)[field] = updates[field];
    }
  }

  employee.profileCompletionPct = calculateProfileCompletion(employee.toObject());
  await employee.save();
  return employee;
}

export async function hardDeleteEmployee(employeeId: string, actorId: string) {
  await connectDB();
  if (employeeId === actorId) throw new Error("CANNOT_DELETE_SELF");

  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error("NOT_FOUND");

  if (employee.role === "hr") {
    const remaining = await countActiveHR(employeeId);
    if (remaining === 0) throw new Error("LAST_HR");
  }

  await Timesheet.deleteMany({ employeeId });
  for (const Model of Object.values(REQUEST_MODELS)) {
    await Model.deleteMany({ employeeId });
  }
  await Document.deleteMany({ employeeId });
  await Asset.deleteMany({ employeeId });
  await Notification.deleteMany({ userId: employeeId });
  await NotificationPreference.deleteMany({ employeeId });
  await PasswordResetToken.deleteMany({ employeeId });

  const files = await FileMetadata.find({ employeeId }).select("_id").lean();
  for (const file of files) {
    try {
      await deleteFileMetadata(file._id.toString());
    } catch {
      // continue cascade even if a file is missing from GridFS
    }
  }

  await Employee.findByIdAndDelete(employeeId);
  return { deleted: true };
}

import { z } from "zod";
import { REQUEST_TYPES } from "@/lib/constants";

export const requestTypeSchema = z.enum(REQUEST_TYPES);

export const gridFSBucketSchema = z.enum(["avatars", "documents", "receipts", "announcements"]);

export const requestActionSchema = z.object({
  action: z.enum(["approve", "reject", "request_cancel", "cancel"]),
  reason: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const shiftSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const punchSchema = z.object({
  action: z.enum(["check_in", "check_out", "break_start", "break_end"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const bootstrapSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const isoDateSchema = z.string().regex(isoDateRegex, "Date must be YYYY-MM-DD");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseIsoDate(value: string) {
  const [y, m, day] = value.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** Date today or in the future (planning requests). */
export const futureOrTodayDateSchema = isoDateSchema.refine(
  (v) => parseIsoDate(v) >= startOfToday(),
  { message: "Date cannot be in the past" }
);

/** Date today or in the past (attendance corrections). */
export const pastOrTodayDateSchema = isoDateSchema.refine(
  (v) => parseIsoDate(v) <= startOfToday(),
  { message: "Date cannot be in the future" }
);

/** Strictly before today (DOB). */
export const pastDateSchema = isoDateSchema.refine(
  (v) => parseIsoDate(v) < startOfToday(),
  { message: "Date must be in the past" }
);

export const holidaySchema = z.object({
  date: isoDateSchema,
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["employee", "hr"]),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  shiftId: z.string().optional(),
  hireDate: pastOrTodayDateSchema,
  dateOfBirth: pastDateSchema,
  nationalId: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  phone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  personalPhone: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  branchCode: z.string().optional(),
  employmentInfo: z.record(z.string(), z.unknown()).optional(),
  qualifications: z
    .array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().min(1),
        year: z.number().int().optional(),
      })
    )
    .optional(),
  relatives: z
    .array(
      z.object({
        name: z.string().min(1),
        relationship: z.string().min(1),
        phone: z.string().optional(),
        isDependent: z.boolean().optional(),
      })
    )
    .optional(),
  sickLeaveDays: z.number().int().min(0).optional(),
  casualLeaveDays: z.number().int().min(0).optional(),
});

export const notificationPatchSchema = z.object({
  ids: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
  typePrefix: z.string().optional(),
});

function nonemptyFutureDates() {
  return z.array(futureOrTodayDateSchema).min(1, "At least one date is required");
}

export function createRequestBodySchema(type: z.infer<typeof requestTypeSchema>) {
  const base = z.object({ reason: z.string().optional() });
  switch (type) {
    case "punch":
      return base
        .extend({
          punchType: z.enum(["check_in", "check_out"]),
          requestedTimestamp: z.string().datetime({ message: "Valid date/time is required" }),
        })
        .superRefine((data, ctx) => {
          const ts = new Date(data.requestedTimestamp);
          if (Number.isNaN(ts.getTime())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid timestamp", path: ["requestedTimestamp"] });
            return;
          }
          if (ts.getTime() > Date.now() + 60_000) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Punch time cannot be in the future",
              path: ["requestedTimestamp"],
            });
          }
        });
    case "leave":
      return base
        .extend({
          leaveType: z.enum(["Sick", "Casual"]),
          startDate: futureOrTodayDateSchema,
          endDate: futureOrTodayDateSchema,
        })
        .superRefine((data, ctx) => {
          if (parseIsoDate(data.endDate) < parseIsoDate(data.startDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "End date must be on or after start date",
              path: ["endDate"],
            });
          }
        });
    case "reimbursement":
      return base.extend({
        amount: z.number().positive(),
        reason: z.string().min(1),
        receiptFileIds: z.array(z.string()).optional(),
      });
    case "loans":
      return base.extend({
        salaryCount: z.number().int().min(1).max(3),
        purpose: z.string().min(1),
        repaymentPlan: z.string().optional(),
      });
    case "wfh":
      return base.extend({
        dates: nonemptyFutureDates(),
      });
    default:
      return base;
  }
}

import connectDB from "@/lib/db";
import { Counter } from "@/lib/models";

export async function generateEmployeeCode() {
  await connectDB();
  const prefix = process.env.COMPANY_CODE_PREFIX || "ADS";
  const counter = await Counter.findByIdAndUpdate(
    "employee_code",
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const seq = String(counter?.seq ?? 1).padStart(5, "0");
  return `${prefix}-${seq}`;
}

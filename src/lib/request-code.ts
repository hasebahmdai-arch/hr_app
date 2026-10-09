import connectDB from "@/lib/db";
import { Counter } from "@/lib/models";
import type { RequestType } from "@/lib/constants";
import { REQUEST_TYPE_PREFIX } from "@/lib/constants";

export async function generateRequestCode(type: RequestType) {
  await connectDB();
  const prefix = REQUEST_TYPE_PREFIX[type];
  const counterId = `request_${type}`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const seq = String(counter?.seq ?? 1).padStart(5, "0");
  return `RQ-${prefix}-${seq}`;
}

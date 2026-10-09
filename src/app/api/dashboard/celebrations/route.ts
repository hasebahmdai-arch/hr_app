import { apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getBirthdaysAndAnniversaries } from "@/lib/celebrations";
import { handleRouteError } from "@/lib/route-utils";
import type { CelebrationsResponse } from "@/types/api";

export async function GET() {
  try {
    await requireSession();
    const data = await getBirthdaysAndAnniversaries();
    return apiSuccess(data as CelebrationsResponse);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";

export function toastApiError(err: unknown, fallback = "Something went wrong") {
  if (err instanceof ApiError) {
    toast.error(err.message || fallback);
    return;
  }
  if (err instanceof Error && err.message) {
    toast.error(err.message);
    return;
  }
  toast.error(fallback);
}

export function toastSuccess(message: string) {
  toast.success(message);
}

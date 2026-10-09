import { apiError } from "@/lib/api-response";

export function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return apiError("Unauthorized", "UNAUTHORIZED", 401);
    if (error.message === "FORBIDDEN") return apiError("Forbidden", "FORBIDDEN", 403);
    if (error.message === "NOT_FOUND") return apiError("Not found", "NOT_FOUND", 404);
    if (error.message === "EMAIL_EXISTS") return apiError("Email already in use", "EMAIL_EXISTS", 409);
    if (error.message === "LAST_HR") return apiError("Cannot remove or deactivate the last HR user", "LAST_HR", 400);
    if (error.message === "CANNOT_DEACTIVATE_SELF") return apiError("Cannot deactivate your own account", "CANNOT_DEACTIVATE_SELF", 400);
    if (error.message === "CANNOT_DELETE_SELF") return apiError("Cannot delete your own account", "CANNOT_DELETE_SELF", 400);
    if (error.message === "INVALID_DEPARTMENT") return apiError("Invalid department", "VALIDATION_ERROR", 400);
    if (error.message === "INVALID_SHIFT") return apiError("Invalid shift", "VALIDATION_ERROR", 400);
    if (error.message === "BOOTSTRAP_DISABLED") return apiError("Setup already completed", "BOOTSTRAP_DISABLED", 403);
    if (error.message === "INVALID_BOOTSTRAP_SECRET") return apiError("Invalid bootstrap secret", "INVALID_BOOTSTRAP_SECRET", 403);
  }
  console.error(error);
  return apiError("Internal server error", "INTERNAL_ERROR", 500);
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  return { page, limit, skip: (page - 1) * limit };
}

export function serializeDoc<T extends { _id?: { toString(): string }; toObject?: () => Record<string, unknown> }>(
  doc: T
) {
  const obj = doc.toObject ? doc.toObject() : (doc as Record<string, unknown>);
  return {
    ...obj,
    _id: obj._id?.toString?.() ?? obj._id,
  };
}

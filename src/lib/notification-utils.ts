import { REQUEST_TYPES, type RequestType } from "@/lib/constants";

export function notificationTypeToRequestType(notificationType: string): RequestType | null {
  const upper = notificationType.toUpperCase();
  for (const t of REQUEST_TYPES) {
    const slug = t.toUpperCase().replace(/-/g, "_");
    if (upper.startsWith(slug)) return t;
  }
  return null;
}

export function requestTypeToNotificationPrefix(type: RequestType): string {
  return type.toUpperCase().replace(/-/g, "_");
}

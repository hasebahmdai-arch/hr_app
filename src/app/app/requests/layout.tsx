"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { REQUEST_TYPES } from "@/lib/constants";
import { REQUEST_LABELS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useMarkNotificationsRead, useUnreadNotificationsByType } from "@/hooks/use-notifications";
import { requestTypeToNotificationPrefix } from "@/lib/notification-utils";
import { NavAttentionDot } from "@/components/shared/requests/RequestTypeHub";
import type { RequestType } from "@/lib/constants";

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";
  const { byType } = useUnreadNotificationsByType();
  const markRead = useMarkNotificationsRead();
  const markReadMutate = useRef(markRead.mutate);
  markReadMutate.current = markRead.mutate;

  const typeMatch = pathname.match(/^\/app\/requests\/([^/]+)$/);
  const activeType = typeMatch?.[1] as RequestType | undefined;

  useEffect(() => {
    if (isHR && activeType && REQUEST_TYPES.includes(activeType)) {
      router.replace("/app/requests");
    }
  }, [isHR, activeType, router]);

  useEffect(() => {
    if (!isHR && activeType && REQUEST_TYPES.includes(activeType)) {
      markReadMutate.current({ typePrefix: requestTypeToNotificationPrefix(activeType) });
    }
  }, [isHR, activeType]);

  if (isHR && activeType) return null;

  return (
    <div className="space-y-4">
      {!isHR && (
        <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {REQUEST_TYPES.map((t) => (
            <Link
              key={t}
              href={`/app/requests/${t}`}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5",
                pathname.includes(`/requests/${t}`) ? "bg-primary text-white border-primary" : "bg-white"
              )}
            >
              {REQUEST_LABELS[t]}
              <NavAttentionDot show={(byType[t] ?? 0) > 0} />
            </Link>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

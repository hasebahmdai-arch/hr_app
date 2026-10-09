"use client";

import { useSession } from "next-auth/react";
import { UnifiedRequestsInbox } from "@/components/shared/requests/UnifiedRequestsInbox";
import { RequestTypeHub } from "@/components/shared/requests/RequestTypeHub";

export default function RequestsPage() {
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";

  if (isHR) return <UnifiedRequestsInbox />;
  return <RequestTypeHub />;
}

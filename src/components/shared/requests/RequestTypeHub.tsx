"use client";

import Link from "next/link";
import { REQUEST_TYPES } from "@/lib/constants";
import { REQUEST_LABELS } from "@/lib/navigation";
import { useUnreadNotificationsByType } from "@/hooks/use-notifications";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavAttentionDot({ show, className }: { show?: boolean; className?: string }) {
  if (!show) return null;
  return <span className={cn("inline-block h-2 w-2 rounded-full bg-primary shrink-0", className)} />;
}

export function RequestTypeHub() {
  const { byType } = useUnreadNotificationsByType();

  return (
    <div className="space-y-4">
      <PageHeader title="Requests" subtitle="Choose a request type" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REQUEST_TYPES.map((t) => (
          <Link key={t} href={`/app/requests/${t}`}>
            <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow h-full">
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-tint flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {REQUEST_LABELS[t]}
                    <NavAttentionDot show={(byType[t] ?? 0) > 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">View & submit</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

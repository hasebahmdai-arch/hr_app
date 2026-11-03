"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function DefaultLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export function QueryBoundary({
  isLoading,
  isError,
  error,
  onRetry,
  children,
  skeleton,
}: {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}) {
  if (isLoading) return <>{skeleton ?? <DefaultLoadingSkeleton />}</>;
  if (isError)
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-sm text-red-700">{error?.message || "Something went wrong"}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  return <>{children}</>;
}

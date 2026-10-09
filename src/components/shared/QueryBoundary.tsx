"use client";

import { Button } from "@/components/ui/button";

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
  if (isLoading) return <>{skeleton ?? <div className="animate-pulse h-32 bg-muted-bg rounded-lg" />}</>;
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

import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CANCELING: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  P: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800",
  M: "bg-yellow-100 text-yellow-800",
  W: "bg-blue-100 text-blue-800",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", variants[status] || "bg-muted-bg", className)}>
      {status}
    </span>
  );
}

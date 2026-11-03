import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  icon,
  accent = "primary",
  className,
  href,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "primary" | "success" | "warning";
  className?: string;
  href?: string;
}) {
  const accentBar = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  }[accent];

  const card = (
    <Card
      className={cn(
        "overflow-hidden shadow-card h-full",
        href && "transition-shadow hover:shadow-elevated hover:border-primary/30 cursor-pointer",
        className
      )}
    >
      <div className={cn("h-1", accentBar)} />
      <div className="p-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{value}</p>
          </div>
          {icon && <div className="text-primary opacity-90 shrink-0">{icon}</div>}
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {card}
      </Link>
    );
  }

  return card;
}

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  icon,
  accent = "primary",
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "primary" | "success" | "warning";
  className?: string;
}) {
  const accentBar = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  }[accent];

  return (
    <Card className={cn("overflow-hidden shadow-card border-0", className)}>
      <div className={cn("h-1", accentBar)} />
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
          </div>
          {icon && <div className="text-primary opacity-90">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

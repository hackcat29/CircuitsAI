import type { LucideIcon } from "lucide-react";
import { Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className={cn(
      "group relative overflow-hidden p-5 flex flex-col gap-3",
      "transition-all duration-200 hover:border-border-strong hover:-translate-y-0.5",
      "hover:shadow-md",
    )}>
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl",
        "bg-accent-violet/10 text-accent-violet",
        "group-hover:bg-accent-violet/18 transition-colors duration-200",
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex flex-col gap-0.5">
        {loading ? (
          <Skeleton className="h-8 w-20 mb-1" />
        ) : (
          <span className="text-2xl font-extrabold tracking-tight leading-none text-text-primary font-mono">
            {value}
          </span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
          {label}
        </span>
      </div>
    </Card>
  );
}

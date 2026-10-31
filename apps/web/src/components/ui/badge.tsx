import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border-subtle bg-white/5 text-text-secondary",
        violet: "border-accent-violet/30 bg-accent-violet/10 text-accent-violet",
        cyan: "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan",
        emerald: "border-emerald/30 bg-emerald/10 text-emerald",
        amber: "border-amber/30 bg-amber/10 text-amber",
        red: "border-red/30 bg-red/10 text-red",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = "Badge";

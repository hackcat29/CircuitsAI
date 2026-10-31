import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border-subtle bg-white/5 px-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus-visible:border-accent-violet/50 focus-visible:ring-2 focus-visible:ring-accent-violet/20 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

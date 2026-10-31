"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/nav";

interface NavDropdownProps {
  label: React.ReactNode;
  items: NavItem[];
  align?: "left" | "right";
  variant?: "plain" | "cta";
}

export function NavDropdown({ label, items, align = "left", variant = "plain" }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          variant === "cta"
            ? "flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.25 rounded-full text-[11.5px] sm:text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all duration-150 whitespace-nowrap shrink-0 shadow-2xs"
            : "flex items-center gap-0.5 px-1.5 py-1 xl:px-2.5 xl:py-1.5 rounded-md text-[11.5px] xl:text-[12.5px] font-semibold transition-all duration-150 whitespace-nowrap shrink-0",
          variant === "plain" &&
            (open
              ? "text-text-primary bg-bg-raised"
              : "text-text-tertiary hover:text-text-secondary hover:bg-bg-raised"),
        )}
      >
        {label}
        <span className={cn("text-[8.5px]", variant === "cta" ? "opacity-80 ml-0.5" : "text-text-quaternary")}>▾</span>
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+8px)] z-20 min-w-42.5 rounded-[10px] border border-border-strong bg-bg-raised shadow-[0_12px_32px_rgba(0,0,0,0.5)] p-1.25",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-2.5 py-2 rounded-md text-[12.5px] font-semibold text-text-secondary hover:bg-bg-surface3 hover:text-text-primary transition-colors duration-100 gap-2"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                {item.icon && <item.icon className="h-3.5 w-3.5 text-accent-violet shrink-0" />}
                <span>{item.label}</span>
              </span>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

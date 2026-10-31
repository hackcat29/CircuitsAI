"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Bot,
  Rocket,
  ArrowRightLeft,
  ShoppingBag,
  Coins,
  Radio,
  UserPlus,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useNotifications, type NotificationItem } from "@/hooks";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

function getNotificationIcon(item: NotificationItem) {
  if (item.type === "NEW_FOLLOWER") {
    return <UserPlus className="h-3.5 w-3.5 text-blue-400" />;
  }
  if (item.operationType === "AGENT_REGISTERED") {
    return <Bot className="h-3.5 w-3.5 text-accent-violet" />;
  }
  if (item.operationType === "TOKEN_LAUNCH_CREATED") {
    return <Rocket className="h-3.5 w-3.5 text-amber-400" />;
  }
  if (item.operationType === "TOKEN_SWAP") {
    return <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-400" />;
  }
  if (item.operationType === "EXCHANGE_LISTED") {
    return <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />;
  }
  if (item.operationType === "SERVICE_PUBLISHED") {
    return <Bot className="h-3.5 w-3.5 text-cyan-400" />;
  }
  if (item.operationType === "AGENT_BROADCAST" || item.type === "AGENT_BROADCAST") {
    return <Radio className="h-3.5 w-3.5 text-pink-400 animate-pulse" />;
  }
  return <Bell className="h-3.5 w-3.5 text-accent-violet" />;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && unreadCount > 0) {
      markAllAsRead();
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative flex items-center justify-center h-8.5 w-8.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors cursor-pointer",
          open && "bg-bg-raised text-text-primary"
        )}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-violet px-1 text-[9.5px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border-strong bg-bg-surface/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
          style={{ background: "rgba(13,14,18,0.96)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-surface2/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-accent-violet/20 text-accent-violet border border-accent-violet/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-text-tertiary hover:text-accent-violet flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="h-3 w-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-border-subtle/40 max-h-[60vh] scrollbar-thin">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-text-tertiary">
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-bg-surface2 border border-border-subtle flex items-center justify-center mx-auto mb-2.5 text-text-quaternary">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-text-secondary">No Notifications</p>
                <p className="text-[11px] text-text-quaternary mt-1 max-w-[240px] mx-auto">
                  Follow creators on Circuits Protocol to receive real-time updates on their token launches, agent deployments, and trades.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const icon = getNotificationIcon(item);
                const timeAgo = formatRelativeTime(item.timestamp);

                const cardContent = (
                  <div className="p-3 hover:bg-white/3 transition-colors flex items-start gap-2.5 group">
                    <div className="p-2 rounded-xl bg-bg-surface2 border border-border-subtle shrink-0 mt-0.5">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary leading-snug group-hover:text-accent-violet transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-text-tertiary truncate mt-0.5">
                        {item.description}
                      </p>
                      <span className="text-[10px] font-mono text-text-quaternary block mt-1">
                        {timeAgo}
                      </span>
                    </div>
                    {item.href && (
                      <ChevronRight className="h-3.5 w-3.5 text-text-quaternary group-hover:text-accent-violet shrink-0 mt-1.5 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </div>
                );

                if (!item.href) {
                  return <div key={item.id}>{cardContent}</div>;
                }

                const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://");

                return isExternal ? (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="block"
                  >
                    {cardContent}
                  </a>
                ) : (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block"
                  >
                    {cardContent}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

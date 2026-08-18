"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarNav } from "./sidebar-nav";
import { getUnreadCount } from "@/lib/api";
import { TrendingUp } from "lucide-react";

export function Sidebar() {
  const { data: unread } = useQuery({
    queryKey: ["unread-alerts"],
    queryFn: getUnreadCount,
    refetchInterval: 15000,
  });

  const unreadCount = unread?.unread_count ?? 0;

  return (
    <aside className="flex h-full flex-col bg-transparent">
      {/* Logo / App Title */}
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-900">StockScout</span>
      </div>

      {/* Navigation */}
      <SidebarNav unreadCount={unreadCount} />

      {/* Footer */}
      <div className="p-6 mt-auto">
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase tracking-widest opacity-60">
          Educational use only.<br/>Not financial advice.
        </p>
      </div>
    </aside>
  );
}

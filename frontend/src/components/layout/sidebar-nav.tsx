"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  BookOpen,
  BarChart3,
  PieChart,
  Bell,
  Settings,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/screener", label: "Screener", icon: Search },
  { href: "/check-stock", label: "Check Stock", icon: Activity },
  { href: "/strategies", label: "Strategies", icon: BookOpen },
  { href: "/backtest", label: "Backtest", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/alerts", label: "Alerts", icon: Bell, showBadge: true },
  { href: "/settings", label: "Data & Settings", icon: Settings },
];

export function SidebarNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-300 group relative",
              isActive
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 font-bold"
                : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.showBadge && unreadCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

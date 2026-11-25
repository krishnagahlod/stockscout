"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity, Home, MoreHorizontal, PieChart, ShieldCheck } from "lucide-react";

type NavItem = { href: string; label: string };
export type NavGroup = { label: string; icon: typeof Home; items: NavItem[]; alsoActive?: string[] };

// The five groups from docs/ui-plan.md: bottom tabs on phones, sidebar sections on desktop.
export const navGroups: NavGroup[] = [
  { label: "Home", icon: Home, items: [{ href: "/home", label: "Home" }] },
  { label: "Market", icon: Activity, items: [
    { href: "/market", label: "Market today" },
    { href: "/funds", label: "Mutual funds" },
    { href: "/compare", label: "Compare" },
  ] },
  { label: "Check", icon: ShieldCheck, items: [{ href: "/check", label: "Check a tip" }], alsoActive: ["/stocks"] },
  { label: "Mine", icon: PieChart, items: [
    { href: "/portfolio", label: "Portfolio" },
    { href: "/practice", label: "Practice" },
  ] },
  { label: "More", icon: MoreHorizontal, items: [
    { href: "/start", label: "Start here" },
    { href: "/ideas", label: "Ideas" },
    { href: "/learn", label: "Learn" },
    { href: "/sources", label: "Where our numbers come from" },
  ] },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
export const groupActive = (pathname: string, g: NavGroup) =>
  [...g.items.map((i) => i.href), ...(g.alsoActive ?? [])].some((h) => isActive(pathname, h));

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" aria-label="Main">
      {navGroups.map((g) => (
        <div key={g.label}>
          {g.items.length > 1 && (
            <p className={cn("flex items-center gap-2 px-4 pb-1 text-[11px] font-bold uppercase tracking-wider",
              groupActive(pathname, g) ? "text-indigo-600" : "text-slate-400")}>
              <g.icon className="h-3.5 w-3.5" /> {g.label}
            </p>
          )}
          <div className="space-y-0.5">
            {g.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm transition-colors",
                  isActive(pathname, item.href)
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                )}
              >
                {g.items.length === 1 && <g.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

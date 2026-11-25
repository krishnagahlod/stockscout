"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { navGroups, groupActive, isActive } from "./sidebar-nav";
import { InstallApp } from "./install-app";
import { SignOutButton } from "./sign-out-button";

/** Phones: Home, Market, Check, Mine, More along the bottom. More opens a sheet with the rest. */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const more = navGroups[navGroups.length - 1];

  return (
    <nav aria-label="Main" className="md:hidden shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {navGroups.map((g) => {
          const active = groupActive(pathname, g);
          const cls = cn("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600",
            active ? "text-indigo-600" : "text-slate-500");
          const inner = <><g.icon className="h-5 w-5" aria-hidden />{g.label}</>;
          return (
            <li key={g.label}>
              {g === more
                ? <button type="button" className={cls} onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>{inner}</button>
                : <Link href={g.items[0].href} className={cls} aria-current={active ? "page" : undefined}>{inner}</Link>}
            </li>
          );
        })}
      </ul>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-white p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetTitle className="px-6 pt-5 text-base">More</SheetTitle>
          <div className="px-4 pt-2 pb-2">
            {more.items.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setMoreOpen(false)}
                className={cn("flex min-h-11 items-center rounded-2xl px-4 text-sm font-medium",
                  isActive(pathname, i.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50")}>
                {i.label}
              </Link>
            ))}
          </div>
          <InstallApp />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-3">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Information, not advice. <Link href="/disclaimer" className="underline" onClick={() => setMoreOpen(false)}>Disclaimer</Link>
            </p>
            <SignOutButton />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

/** Tabs at the top of a group's pages (Market today | Mutual funds | Compare, Portfolio | Practice). */
export function SectionTabs() {
  const pathname = usePathname();
  const g = navGroups.find((g) => g.label !== "More" && g.items.length > 1 && g.items.some((i) => isActive(pathname, i.href)));
  if (!g) return null;
  return (
    <nav aria-label={g.label} className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1 w-fit max-w-full">
      {g.items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(pathname, i.href) ? "page" : undefined}
          className={cn("whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold min-h-10 flex items-center",
            isActive(pathname, i.href) ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHealth } from "@/hooks/use-stocks";
import { Moon, Sun, Menu, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { GlobalSearch } from "./global-search";

export function Header() {
  const { data: health } = useHealth();

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between bg-transparent px-4 md:px-8">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-white/95 backdrop-blur-xl">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex h-16 items-center gap-2 border-b border-slate-200/60 px-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-800">StockScout</span>
            </div>
            <SidebarNav unreadCount={0} />
          </SheetContent>
        </Sheet>
        <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-800 md:hidden">StockScout</h1>
        <div className="hidden md:block">
          <GlobalSearch />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <GlobalSearch />
        </div>
        {health && (
          <div className="hidden sm:flex items-center gap-3 bg-slate-50/80 px-4 py-1.5 rounded-full border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {health.db_connected !== false && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${health.db_connected !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              <span className="text-xs font-medium text-slate-600">
                {health.db_connected !== false ? "Connected" : "Error"}
              </span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <span className="text-xs font-medium text-slate-500">
              {health.stock_count || 0} stocks
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

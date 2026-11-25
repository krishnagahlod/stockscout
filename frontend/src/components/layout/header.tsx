"use client";

import { Button } from "@/components/ui/button";
import { Menu, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { GlobalSearch } from "./global-search";
import { SignOutButton } from "./sign-out-button";
import { InstallApp } from "./install-app";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between gap-3 bg-transparent px-4 md:px-8">
      <div className="flex items-center gap-3 flex-1">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-white/95 backdrop-blur-xl">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center gap-2 border-b border-slate-200/60 px-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-display font-bold tracking-tight text-slate-900">StockScout</span>
            </div>
            <SidebarNav />
            <InstallApp />
          </SheetContent>
        </Sheet>
        <span className="text-lg font-display font-bold tracking-tight text-slate-900 md:hidden">StockScout</span>
        <GlobalSearch />
      </div>
      <SignOutButton />
    </header>
  );
}

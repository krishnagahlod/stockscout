import { SidebarNav } from "./sidebar-nav";
import { TrendingUp } from "lucide-react";
import { InstallApp } from "./install-app";
import { SignOutButton } from "./sign-out-button";

export function Sidebar() {
  return (
    <aside className="flex h-full flex-col bg-transparent">
      <div className="flex h-20 shrink-0 items-center gap-3 px-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-900">StockScout</span>
      </div>

      <SidebarNav />
      <InstallApp />

      <div className="shrink-0 border-t border-slate-100 px-4 py-3">
        <SignOutButton />
      </div>
    </aside>
  );
}

import { SidebarNav } from "./sidebar-nav";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="flex h-full flex-col bg-transparent">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-900">StockScout</span>
      </div>

      <SidebarNav />

      <div className="p-6 mt-auto">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Information, not advice. You decide, and you trade in your own broker app.{" "}
          <Link href="/sources" className="underline underline-offset-2 hover:text-indigo-600">Where our numbers come from</Link>
        </p>
      </div>
    </aside>
  );
}

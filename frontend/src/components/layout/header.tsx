import { TrendingUp } from "lucide-react";
import { GlobalSearch } from "./global-search";

/** Phones: name and search only (the menu is the bottom tab bar). Desktop: search. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 md:h-20 items-center justify-between gap-3 bg-transparent px-4 md:px-8">
      <span className="flex items-center gap-2 text-lg font-display font-bold tracking-tight text-slate-900 md:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600"><TrendingUp className="h-4 w-4 text-white" /></span>
        StockScout
      </span>
      <GlobalSearch />
    </header>
  );
}

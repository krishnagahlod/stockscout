"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Overview | Results | Owners | All numbers | News. Every panel is rendered once and only hidden, so charts keep their state. */
export function StockTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next == null) return;
    const j = (next + tabs.length) % tabs.length;
    setActive(tabs[j].id);
    refs.current[j]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="About this company" className="sticky top-0 z-30 -mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/90 p-1 backdrop-blur">
        {tabs.map((t, i) => (
          <button key={t.id} id={`tab-${t.id}`} ref={(el) => { refs.current[i] = el; }} type="button" role="tab"
            aria-selected={active === t.id} aria-controls={`panel-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cn("min-h-10 whitespace-nowrap rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600",
              active === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="mt-5 space-y-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}

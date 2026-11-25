import { cn } from "@/lib/utils";
import { METRICS, formatMetric, type MetricKey } from "@/lib/metrics";
import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { METRIC_LESSON } from "@/lib/lessons";
import { SOURCES, type SourceId } from "@/lib/sources";
import { niceDate } from "@/lib/format";

export function Panel({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("glass-card rounded-3xl p-5 md:p-6", className)} {...props}>
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** +2.3% in green / −1.1% in red. Value is a decimal (0.023). */
export function Change({ value, className, suffix }: { value: number | null | undefined; className?: string; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-slate-400", className)}>—</span>;
  const up = value >= 0;
  return (
    <span className={cn("font-semibold tabular-nums", up ? "text-emerald-600" : "text-rose-600", className)}>
      {up ? "▲" : "▼"} {Math.abs(value * 100).toFixed(1)}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** A metric with its plain-language meaning one tap away. */
export function MetricRow({ metric, value, note }: { metric: MetricKey; value: number | null; note?: string }) {
  const info = METRICS[metric];
  return (
    <details className="group border-b border-slate-100 last:border-0 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          {info.label}
          <span className="text-xs text-slate-400">({info.short})</span>
          <HelpCircle className="h-3.5 w-3.5 text-slate-300 group-open:text-indigo-500" aria-hidden />
        </span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{formatMetric(metric, value)}</span>
      </summary>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
        {info.explain}
        {note && <span className="block mt-1 text-slate-600">{note}</span>}
        {METRIC_LESSON[metric] && <Link href={`/learn/${METRIC_LESSON[metric]}`} className="mt-1 block font-medium text-indigo-600 underline">2-minute lesson</Link>}
      </p>
    </details>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3 text-sm",
      tone === "warn" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-indigo-50/70 text-indigo-900 border border-indigo-100")}>
      {children}
    </div>
  );
}

/** One quiet line under a data panel: which source each kind of number comes from, and how fresh it is. */
export function Sources({ ids, asOf, className }: { ids: SourceId[]; asOf?: string | null; className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-slate-500", className)}>
      Sources: {ids.map((id, i) => (
        <span key={id}>{i > 0 && "; "}{SOURCES[id].name} for {SOURCES[id].short}</span>
      ))}
      {asOf && <>. Data up to the close of {niceDate(asOf)}</>}.{" "}
      <Link href="/sources" className="underline underline-offset-2 hover:text-indigo-600">How we get and check our data</Link>
    </p>
  );
}

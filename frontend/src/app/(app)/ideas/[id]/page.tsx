import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUniverse, dataAsOf } from "@/lib/market";
import { makePlan, runRules, sanitizeRules, type IdeaRules } from "@/lib/rules";
import { METRICS, formatMetric, yearChange } from "@/lib/metrics";
import { STARTER_IDEAS } from "@/lib/starter-ideas";
import { niceDate, rupees, shortTicker } from "@/lib/format";
import { Change, Empty, Notice, Panel } from "@/components/kit";
import { BoughtButton, BudgetForm, DeleteIdeaButton, SaveStarterButton } from "./idea-controls";

export default async function IdeaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ budget?: string }> }) {
  const { id } = await params;
  const budget = Math.max(0, Math.round(Number((await searchParams).budget) || 0));
  const supabase = await createClient();
  const universe = await getUniverse(supabase);
  const sectors = Array.from(new Set(universe.map((s) => s.sector)));

  let rules: IdeaRules | null = null;
  let savedId: number | null = null;
  let userPrompt = "";
  if (id.startsWith("s-")) {
    rules = STARTER_IDEAS.find((s) => s.slug === id.slice(2)) ?? null;
  } else if (/^\d+$/.test(id)) {
    const { data } = await supabase.from("strategies").select("id, rules_json, user_prompt").eq("id", Number(id)).maybeSingle();
    if (data) {
      rules = sanitizeRules(data.rules_json, sectors);
      savedId = data.id;
      userPrompt = data.user_prompt ?? "";
    }
  }
  if (!rules) notFound();

  const { picks, matched } = runRules(rules, universe);
  const plan = budget ? makePlan(picks, budget) : null;
  const asOf = dataAsOf(universe);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/ideas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />All ideas</Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{rules.name}</h1>
          {userPrompt && <p className="mt-1 text-sm text-slate-500 italic">“{userPrompt}”</p>}
          <p className="mt-3 text-slate-700 max-w-2xl leading-relaxed">{rules.summary}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {savedId ? <DeleteIdeaButton id={savedId} /> : <SaveStarterButton rules={rules} />}
        </div>
      </div>

      {rules.note && <Notice tone="warn">{rules.note}</Notice>}

      <Panel>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Your plan</h2>
            <p className="text-sm text-slate-500">Enter an amount and we&apos;ll split it into whole shares across the companies below.</p>
          </div>
          <BudgetForm budget={budget} />
        </div>
        {plan && (
          plan.lines.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">{rupees(budget)} isn&apos;t enough for even one share of these companies. Try a larger amount, or pick fewer companies.</p>
          ) : (
            <div className="mt-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-2 font-medium">Company</th><th className="py-2 font-medium text-right">Price</th><th className="py-2 font-medium text-right">Shares</th><th className="py-2 font-medium text-right">Amount</th></tr></thead>
                  <tbody>
                    {plan.lines.map((l) => (
                      <tr key={l.ticker} className="border-b border-slate-50">
                        <td className="py-2"><Link href={`/stocks/${shortTicker(l.ticker)}`} className="font-medium text-slate-900 hover:text-indigo-600">{l.name}</Link></td>
                        <td className="py-2 text-right tabular-nums">{rupees(l.price, true)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{l.shares}</td>
                        <td className="py-2 text-right tabular-nums">{rupees(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Total {rupees(budget - plan.leftover)} · {rupees(plan.leftover)} left over
                {plan.tooExpensive.length > 0 && <> · skipped {plan.tooExpensive.map(shortTicker).join(", ")} (one share costs more than its part of your budget)</>}
              </p>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-xs text-slate-500 max-w-md">You place these orders yourself in your broker app (Zerodha, Groww, etc.). Prices are from {niceDate(asOf)} and will have moved; adjust share counts to today&apos;s price.</p>
                <BoughtButton lines={plan.lines} />
              </div>
            </div>
          )
        )}
      </Panel>

      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Companies that fit</h2>
        <p className="text-sm text-slate-500 mb-4">{matched} of {universe.length} companies match the rules; these are the closest fits, with at most two per industry so your money is spread out.</p>
        {picks.length === 0 ? (
          <Empty title="No company matches all the rules right now">Try a looser idea, or one of the ready-made ones.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {picks.map((p, i) => (
              <Link key={p.stock.stock_id} href={`/stocks/${shortTicker(p.stock.ticker)}`} className="glass-card rounded-3xl p-5 hover:shadow-premium-hover block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">#{i + 1} · {p.stock.sector}</p>
                    <p className="font-semibold text-slate-900 truncate">{p.stock.name}</p>
                    <p className="text-xs text-slate-500">{shortTicker(p.stock.ticker)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">{rupees(p.stock.price, true)}</p>
                    <Change value={yearChange(p.stock)} suffix="1y" className="text-xs" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100" title={`Fit ${p.score}/100`}>
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.max(p.score, 4)}%` }} />
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {p.reasons.map((r) => <li key={r}>• {r}</li>)}
                </ul>
              </Link>
            ))}
          </div>
        )}
      </div>

      {rules.risks.length > 0 && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-500" />What could go wrong</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">{rules.risks.map((r) => <li key={r}>• {r}</li>)}</ul>
        </Panel>
      )}

      <details className="glass-card rounded-3xl p-5 md:p-6 group">
        <summary className="cursor-pointer font-display font-bold text-slate-900 list-none">How we picked these <span className="text-sm font-normal text-slate-500 group-open:hidden">(tap to see the rules and numbers)</span></summary>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-semibold">Every company must have:</p>
            <ul className="mt-1 space-y-1">
              {rules.filters.map((f) => <li key={f.metric + f.op}>• {METRICS[f.metric].label} {f.op === ">" ? "above" : "below"} {formatMetric(f.metric, f.value)} <span className="text-slate-400">({METRICS[f.metric].short})</span></li>)}
              {rules.sectors_include.length > 0 && <li>• Industry is one of: {rules.sectors_include.join(", ")}</li>}
              {rules.sectors_exclude.length > 0 && <li>• Industry is not: {rules.sectors_exclude.join(", ")}</li>}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Then we rank them by:</p>
            <ul className="mt-1 space-y-1">{rules.rank_by.map((r) => <li key={r.metric}>• {r.prefer === "high" ? "Higher" : "Lower"} {METRICS[r.metric].label.toLowerCase()}{rules.rank_by.length > 1 ? ` (weight ${r.weight})` : ""}</li>)}</ul>
          </div>
          <p className="text-slate-500">The fit bar shows how a company ranks among the matches on these points (100 = best). Prices from {niceDate(asOf)}. Company numbers come from the latest reports we have. This is information to help you decide, not advice; past numbers don&apos;t promise future returns.</p>
        </div>
      </details>
    </div>
  );
}

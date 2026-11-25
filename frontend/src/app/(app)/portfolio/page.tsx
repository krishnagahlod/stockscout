import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getSnapshots, dataAsOf } from "@/lib/market";
import { summarize, type HoldingRow } from "@/lib/portfolio";
import { upcoming, type StockEvent } from "@/lib/events";
import { TAX, taxIfSoldToday } from "@/lib/tax";
import { niceDate, pct, rupees } from "@/lib/format";
import { Change, Empty, PageTitle, Panel, Sources } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { AddHoldingForm } from "./add-holding-form";
import { ImportCSVModal } from "./import-csv-modal";
import { SectorAllocationChart } from "./sector-allocation-chart";
import { HoldingsTable } from "./holdings-table";

export const metadata = { title: "Portfolio | StockScout" };

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select("id, stock_id, quantity, avg_buy_price, acquired_date")
    .eq("user_id", user.id);
  if (error) throw new Error(`Could not load holdings: ${error.message}`);

  const rows = (holdings ?? []) as HoldingRow[];
  const snaps = await getSnapshots(supabase, Array.from(new Set(rows.map((h) => h.stock_id))));
  const s = summarize(rows, snaps);
  const asOf = dataAsOf(Array.from(snaps.values()));
  const today = new Date().toISOString().slice(0, 10);
  const { data: eventRows } = snaps.size
    ? await supabase.from("stock_events").select("stock_id, kind, event_date, amount, source").in("stock_id", Array.from(snaps.keys())).gte("event_date", today)
    : { data: [] };
  const soon = upcoming((eventRows ?? []) as StockEvent[], today, 60).filter((e) => e.kind !== "split");
  const tax = taxIfSoldToday(
    (rows as (HoldingRow & { acquired_date: string | null })[]).flatMap((h) => {
      const st = snaps.get(h.stock_id);
      return st?.price ? [{ name: st.name, quantity: h.quantity, buyPrice: Number(h.avg_buy_price), boughtOn: h.acquired_date, price: st.price }] : [];
    }),
    today,
  );

  const actions = (
    <div className="flex gap-2">
      <ImportCSVModal />
      <AddHoldingForm />
    </div>
  );

  if (!s.positions.length) {
    return (
      <div className="max-w-5xl mx-auto">
        <PageTitle title="Portfolio" subtitle="Everything you own in one place, explained simply." action={actions} />
        <Empty title="Nothing here yet">
          Add the shares you already own, import a CSV from your broker, or{" "}
          <Link href="/ideas" className="text-indigo-600 underline">find an idea to start with</Link>.
        </Empty>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageTitle title="Portfolio" subtitle={<>Prices as of {niceDate(asOf)}. You place trades in your broker app; record them here to track them.</>} action={actions} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-sm text-slate-500">Worth today</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{rupees(s.value)}</p>
          <p className="mt-1 text-sm">{s.dayPnl >= 0 ? "+" : "−"}{rupees(Math.abs(s.dayPnl))} <Change value={s.dayPct} className="text-sm" suffix="on the last day" /></p>
        </Panel>
        <Panel>
          <p className="text-sm text-slate-500">You put in</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{rupees(s.invested)}</p>
          <p className="mt-1 text-sm text-slate-500">{s.positions.length} companies</p>
        </Panel>
        <Panel>
          <p className="text-sm text-slate-500">Total gain / loss</p>
          <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${s.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{s.pnl >= 0 ? "+" : "−"}{rupees(Math.abs(s.pnl))}</p>
          <p className="mt-1 text-sm text-slate-500">{pct(s.pnlPct, 1, true)} since you bought</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Health check</h2>
          <div className="space-y-3">
            {s.checks.map((c) => (
              <div key={c.title} className="flex gap-3">
                {c.tone === "good" ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-semibold text-slate-900">{c.title}</p>
                  <p className="text-sm text-slate-600">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/ideas"><Button variant="secondary" className="mt-5 rounded-xl"><Sparkles className="h-4 w-4 mr-2" />Find companies to balance this out</Button></Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Spread by industry</h2>
          <SectorAllocationChart data={s.sectors.map(({ name, value }) => ({ name, value }))} currentValue={s.value} />
        </Panel>
      </div>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-3">What you own</h2>
        <HoldingsTable positions={s.positions} />
        {s.unpriced > 0 && <p className="mt-3 text-xs text-slate-500">{s.unpriced} holding(s) aren&apos;t shown because we have no price for them.</p>}
      </Panel>

      {tax.rows.length > 0 && (
        <details className="glass-card rounded-3xl p-5 md:p-6 group">
          <summary className="cursor-pointer list-none font-display font-bold text-slate-900">If you sold everything today: tax <span className="text-sm font-normal text-slate-500 group-open:hidden">(an estimate, tap to see)</span></summary>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p className="text-base">Estimated tax: <strong className="font-semibold">{rupees(tax.tax)}</strong></p>
            <ul className="space-y-1">
              <li>Short-term gain (held 12 months or less): {rupees(tax.shortGain)}, taxed at {TAX.stcg * 100}%.</li>
              <li>Long-term gain (held more than 12 months): {rupees(tax.longGain)}. The first {rupees(TAX.exemption)} a year is tax-free{tax.exemptionUsed > 0 ? ` (${rupees(tax.exemptionUsed)} used here)` : ""}; the rest is taxed at {TAX.ltcg * 100}%.</li>
              <li>A {TAX.cess * 100}% cess is added on top. Short-term losses can reduce long-term gains.</li>
            </ul>
            {tax.unknownDates > 0 && <p className="text-amber-800">{tax.unknownDates} holding{tax.unknownDates > 1 ? "s have" : " has"} no purchase date, so we treated {tax.unknownDates > 1 ? "them" : "it"} as short-term.</p>}
            <p className="text-xs text-slate-500">Purchase dates are the ones you entered (for older or imported holdings, the day they were added). Rates from the July 2024 budget, for listed shares and equity ETFs; surcharge, older grandfathering rules and gains you already took this year aren&apos;t included. Check the current rules or a tax professional before filing.</p>
          </div>
        </details>
      )}

      {soon.length > 0 && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">Coming up for what you own</h2>
          <p className="text-sm text-slate-500">The next 60 days. Results dates marked “estimate” haven&apos;t been announced by the company yet and can move.</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {soon.map((e) => (
              <li key={`${e.stock_id}-${e.kind}-${e.event_date}`} className="flex justify-between gap-3 py-2">
                <span><span className="font-medium text-slate-900">{snaps.get(e.stock_id)?.name}</span> {e.kind === "results" ? "reports results" : `goes ex-dividend (₹${Number(e.amount).toFixed(2)} a share)`}</span>
                <span className="shrink-0 text-slate-500">{niceDate(e.event_date)}{e.kind === "results" && e.source !== "nse" && " (estimate)"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Sources ids={["nse", "yahooCompany", "own"]} />
    </div>
  );
}

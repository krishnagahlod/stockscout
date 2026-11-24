"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Change, PageTitle, Panel } from "@/components/kit";
import { niceDate, rupees } from "@/lib/format";
import type { Fall, Point } from "@/lib/risk";

export type FundRow = { ticker: string; name: string; follows: string; price: number | null; priceDate: string | null; year: number | null; worstYear: number | null };
type Rolling = { worst: number; best: number; lossShare: number; count: number } | null;
export type NiftyFacts = {
  asOf: string;
  since: string;
  grown: { start: Point; value: number } | null;
  fall: Fall;
  recoveryMonths: number | null;
  oneYear: Rolling;
  fiveYear: Rolling;
};

type Goal = "long" | "soon" | "emergency" | "learn";
type Answers = { goal?: Goal; cushion?: "yes" | "no"; debt?: "yes" | "no" };

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "long", label: "Growing it over 5 years or more", hint: "Money you won't need for a while" },
  { id: "soon", label: "Something in the next 3 years", hint: "Fees, a laptop, a trip" },
  { id: "emergency", label: "Emergency money", hint: "In case something goes wrong" },
  { id: "learn", label: "Learning with a small amount", hint: "₹500 to ₹2,000 to see how it works" },
];

const pct0 = (x: number) => `${Math.abs(Math.round(x * 100))}%`;
const often = (share: number) => (share === 0 ? "never, so far" : share < 0.01 ? "less than 1% of the time" : `${Math.round(share * 100)}% of the time`);

function Question<T extends string>({ name, legend, options, value, onChange }: {
  name: string; legend: string; options: { id: T; label: string; hint?: string }[]; value?: T; onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="font-display text-lg font-bold text-slate-900">{legend}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-400">
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="mt-1 accent-indigo-600" />
            <span>
              <span className="block font-medium text-slate-900">{o.label}</span>
              {o.hint && <span className="block text-sm text-slate-500">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-3">
      <span className="font-display text-2xl font-bold text-indigo-600">{n}</span>
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
        <div className="mt-2 space-y-3 text-slate-700 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function FundTable({ funds, showWorst }: { funds: FundRow[]; showWorst?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-slate-500">
            <th className="py-2 font-medium">Fund</th>
            {showWorst && <th className="py-2 font-medium">Follows</th>}
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">1 year</th>
            {showWorst && <th className="py-2 text-right font-medium">Worst fall, past year</th>}
          </tr>
        </thead>
        <tbody>
          {funds.map((f) => (
            <tr key={f.ticker} className="border-b border-slate-50">
              <td className="py-2"><Link href={`/stocks/${f.ticker}`} className="font-medium text-slate-900 hover:text-indigo-600">{f.name}</Link><span className="block text-xs text-slate-400">{f.ticker}</span></td>
              {showWorst && <td className="py-2 text-slate-600">{f.follows}</td>}
              <td className="py-2 text-right tabular-nums">{rupees(f.price, true)}</td>
              <td className="py-2 text-right"><Change value={f.year} /></td>
              {showWorst && <td className="py-2 text-right tabular-nums text-slate-600">{f.worstYear != null ? `−${pct0(f.worstYear)}` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StartFlow({ facts, funds }: { facts: NiftyFacts | null; funds: FundRow[] }) {
  const [a, setA] = useState<Answers>({});
  const set = (patch: Answers) => setA((prev) => ({ ...prev, ...patch }));
  const shortTerm = a.goal === "soon" || a.goal === "emergency";
  const needsCushion = a.goal === "long";
  const done = a.goal && (shortTerm || ((!needsCushion || a.cushion) && a.debt));
  const nifty50 = funds.filter((f) => f.follows === "Nifty 50");
  const others = funds.filter((f) => f.follows !== "Nifty 50");
  const priceDate = funds[0]?.priceDate;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle title="Start here" subtitle="Three quick questions, then a plain path for your first money. Nothing is saved." />

      <Panel className="space-y-8">
        <Question name="goal" legend="What is this money for?" options={GOALS} value={a.goal} onChange={(goal) => setA({ goal })} />
        {a.goal && !shortTerm && needsCushion && (
          <Question name="cushion" legend="Do you have money kept aside for emergencies?" value={a.cushion} onChange={(cushion) => set({ cushion })}
            options={[{ id: "yes", label: "Yes", hint: "Enough for a surprise bill or a few months of expenses" }, { id: "no", label: "Not yet" }]} />
        )}
        {a.goal && !shortTerm && (!needsCushion || a.cushion) && (
          <Question name="debt" legend="Do you owe money on a credit card or a high-interest loan?" value={a.debt} onChange={(debt) => set({ debt })}
            options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
        )}
        {a.goal && (
          <button type="button" onClick={() => setA({})} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600"><RotateCcw className="h-3.5 w-3.5" />Start over</button>
        )}
      </Panel>

      {done && shortTerm && (
        <Panel className="space-y-3 border-l-4 border-amber-400">
          <h2 className="font-display text-xl font-bold text-slate-900">Keep this money out of shares</h2>
          <p className="text-slate-700 leading-relaxed">
            Shares can fall a lot in a short time.
            {facts && <> Even the Nifty 50, India&apos;s 50 biggest companies, fell {pct0(facts.fall.fall)} between {niceDate(facts.fall.peakDate)} and {niceDate(facts.fall.troughDate)}.</>}
            {" "}Money you may need within three years, or in an emergency, belongs somewhere steadier:
          </p>
          <ul className="space-y-2 text-slate-700">
            <li><strong className="font-semibold">Savings account.</strong> Take it out any day. Lower interest.</li>
            <li><strong className="font-semibold">Fixed deposit (FD).</strong> A fixed rate for a fixed time. Breaking it early costs a little interest.</li>
            <li><strong className="font-semibold">Liquid mutual fund.</strong> Lends money for days or weeks to safe borrowers. Usually a bit more than a savings account, and you can withdraw in a day or so. Not guaranteed.</li>
          </ul>
          <p className="text-sm text-slate-500">If you also have money for the long term, choose &ldquo;Growing it over 5 years or more&rdquo; above.</p>
        </Panel>
      )}

      {done && !shortTerm && (
        <>
          {a.debt === "yes" && (
            <Panel className="border-l-4 border-amber-400">
              <h2 className="font-display text-xl font-bold text-slate-900">First, clear the card or loan</h2>
              <p className="mt-2 text-slate-700 leading-relaxed">Credit cards in India usually charge around 3% to 3.75% a month on unpaid dues, which is roughly 40% a year. No investment reliably earns that much, so paying it off is the best &ldquo;return&rdquo; you can get. The path below is for when it&apos;s cleared.</p>
            </Panel>
          )}
          {a.cushion === "no" && (
            <Panel className="border-l-4 border-amber-400">
              <h2 className="font-display text-xl font-bold text-slate-900">First, build a small cushion</h2>
              <p className="mt-2 text-slate-700 leading-relaxed">Keep some money in a savings account or FD before you buy shares. Even ₹5,000 to ₹10,000 means a surprise bill won&apos;t force you to sell shares at a bad moment, which is how many first-time investors lose money.</p>
            </Panel>
          )}

          <Panel>
            <h2 className="font-display text-xl font-bold text-slate-900">A plain path for your first money</h2>
            <p className="mt-1 text-sm text-slate-500">General steps, not advice for your situation. StockScout earns nothing from any fund or broker.</p>
            <ol className="mt-6 space-y-8">
              <Step n={1} title="Start with the whole market, not one company">
                <p>The Nifty 50 is a list of India&apos;s 50 biggest listed companies. An index fund or ETF that follows it buys all 50 in one go, so one company&apos;s bad year hurts you much less.</p>
                {facts && (
                  <div className="rounded-2xl bg-slate-50 p-4 text-[15px] space-y-2">
                    {facts.grown && <p>₹10,000 put into the Nifty 50 on {niceDate(facts.grown.start.date)} was worth <strong>{rupees(facts.grown.value)}</strong> on {niceDate(facts.asOf)}, counting price only.</p>}
                    <p>Its worst fall in our data: <strong>−{pct0(facts.fall.fall)}</strong>, from {niceDate(facts.fall.peakDate)} to {niceDate(facts.fall.troughDate)}.{facts.fall.recoveredDate ? ` It was back at its old high ${facts.recoveryMonths} months later.` : " It hasn't yet returned to that high."}</p>
                    {facts.oneYear && facts.fiveYear && (
                      <p>Held for any 1 year since {facts.since.slice(0, 4)}, it lost money {often(facts.oneYear.lossShare)}. Held for any 5 years, it lost money {often(facts.fiveYear.lossShare)}.</p>
                    )}
                    <p className="text-xs text-slate-500">Past numbers don&apos;t promise future returns. Time in the market lowered the risk of a loss here; it didn&apos;t remove it.</p>
                  </div>
                )}
                {nifty50.length > 0 && (
                  <>
                    <p>Nifty 50 ETFs trade like shares in your broker app. Here are three from different fund houses, as examples. They hold the same 50 companies; before choosing, compare the yearly fee (the expense ratio, on the fund&apos;s factsheet) and how much trades each day.</p>
                    <FundTable funds={nifty50} />
                  </>
                )}
                <p className="text-sm text-slate-500">Prefer a fixed amount every month (a SIP)? Nifty 50 index mutual funds do the same job without buying whole units. Fund pages are coming to StockScout.</p>
              </Step>
              <Step n={2} title="Practise if you're nervous">
                <p>Buy with ₹1,00,000 of pretend money at real closing prices. It&apos;s the safest way to feel what a 10% fall is like before it&apos;s your own money.</p>
                <Link href="/practice" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700">Open practice <ArrowRight className="h-4 w-4" /></Link>
              </Step>
              <Step n={3} title="Add single companies only when you can say why">
                <p>Once the base is in place, look at individual companies that match what you care about. Keep any one company to a small part of your money.</p>
                <Link href="/ideas" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700">Explore ideas <ArrowRight className="h-4 w-4" /></Link>
              </Step>
              <Step n={4} title="Check every tip before acting on it">
                <p>A stock from a group chat or a reel? Look up its numbers first: how big the company is, whether it makes a profit, and how sharply the price has jumped.</p>
                <Link href="/check" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700">Check a tip <ArrowRight className="h-4 w-4" /></Link>
              </Step>
            </ol>
          </Panel>

          {others.length > 0 && (
            <details className="glass-card rounded-3xl p-5 md:p-6 group">
              <summary className="cursor-pointer list-none font-display font-bold text-slate-900">Other ETFs worth knowing <span className="text-sm font-normal text-slate-500 group-open:hidden">(tap to see)</span></summary>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>Nifty Next 50 holds the 50 companies just below the Nifty 50. Midcap 50 holds 50 medium-sized companies, with bigger ups and downs. Gold often moves differently from shares, which is why some people keep a little.</p>
                <FundTable funds={others} showWorst />
                {priceDate && <p className="text-xs text-slate-500">Prices as of close on {niceDate(priceDate)}.</p>}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

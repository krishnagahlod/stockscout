"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, Loader2, MessageSquareWarning, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/kit";
import { crores, niceDate, rupees } from "@/lib/format";
import { checkTip, type CheckState } from "./actions";

function headline(s: CheckState): string {
  const red = (s.companies ?? []).reduce((n, c) => n + c.flags.filter((f) => f.level === "red").length, 0);
  const amber = (s.companies ?? []).reduce((n, c) => n + c.flags.filter((f) => f.level === "amber").length, 0);
  const parts = [
    red && `${red} red flag${red > 1 ? "s" : ""}`,
    amber && `${amber} thing${amber > 1 ? "s" : ""} to watch`,
    s.hype?.length && `${s.hype.length} hype phrase${s.hype.length > 1 ? "s" : ""}`,
    s.unknown?.length && `${s.unknown.length} unknown name${s.unknown.length > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.length ? `Found ${parts.join(", ")}.` : "No red flags in the numbers or the wording.";
}

export function CheckForm() {
  const [state, action, pending] = useActionState(checkTip, {} as CheckState);
  const nothingFound = state.checked && !state.companies?.length && !state.unknown?.length;

  return (
    <>
      <Panel>
        <form action={action} className="space-y-3">
          <label htmlFor="tip" className="font-display text-lg font-bold text-slate-900">The tip</label>
          <textarea id="tip" name="text" rows={5} maxLength={3000} required
            placeholder={"Paste the message, e.g. \"🚀 Sure shot! Buy XYZ now, target ₹600\"\nor just type a company name, e.g. Coal India"}
            className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-indigo-400" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-xl" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check it</Button>
            <span className="text-xs text-slate-500">The message isn&apos;t saved.</span>
          </div>
          {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
        </form>
      </Panel>

      {state.checked && (
        <section id="tip-results" aria-live="polite" className="space-y-4">
          <p className="font-display text-xl font-bold text-slate-900">{headline(state)}</p>
          {state.summary && (
            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
              <p className="text-[15px] leading-relaxed text-slate-800">{state.summary}</p>
              <p className="mt-1 text-xs text-slate-500">Summary written by AI from the checks below. It can be wrong; the checks are what count.</p>
            </div>
          )}

          {!!state.hype?.length && (
            <Panel className="border-l-4 border-rose-400">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><MessageSquareWarning className="h-5 w-5 text-rose-500" />The message uses sales talk</h2>
              <p className="mt-2 flex flex-wrap gap-2">{state.hype.map((h) => <span key={h} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-800">{h}</span>)}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Phrases like these are common in pump-and-dump messages, where early buyers sell to the people who follow the tip. Real research talks about risks and never promises a return.</p>
            </Panel>
          )}

          {!!state.unknown?.length && (
            <Panel className="border-l-4 border-amber-400">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><SearchX className="h-5 w-5 text-amber-500" />Not in the Nifty 500: {state.unknown.join(", ")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">We don&apos;t have numbers for {state.unknown.length > 1 ? "these" : "this"}, so we can&apos;t check {state.unknown.length > 1 ? "them" : "it"}. Most stocks in SEBI&apos;s May 2026 pump-and-dump case were small companies outside the big indices. Be extra careful with names you can&apos;t look up.</p>
            </Panel>
          )}

          {nothingFound && (
            <Panel>
              <p className="text-slate-700">We couldn&apos;t find a Nifty 500 company in that. Try the name as it&apos;s listed, like &ldquo;Coal India&rdquo;, or its NSE code in capitals, like COALINDIA.</p>
            </Panel>
          )}

          {state.companies?.map((c) => (
            <Panel key={c.ticker}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/stocks/${c.ticker}`} className="font-display text-lg font-bold text-slate-900 hover:text-indigo-600">{c.name}</Link>
                  <p className="text-sm text-slate-500">{c.ticker} · {c.sector} · size {crores(c.marketCap)}</p>
                </div>
                <p className="text-right text-sm text-slate-500"><span className="block font-semibold text-slate-900 tabular-nums">{rupees(c.price, true)}</span>close on {niceDate(c.priceDate)}</p>
              </div>
              {c.flags.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {c.flags.map((f) => (
                    <li key={f.text} className="flex gap-2 text-[15px] leading-relaxed text-slate-700">
                      {f.level === "red" ? <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-label="Red flag" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Worth watching" />}
                      {f.text}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 text-[15px] text-slate-700">No red flags in its numbers.</p>}
              {c.fine.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-sm font-medium text-slate-500">What checks out</p>
                  <ul className="mt-1 space-y-1">
                    {c.fine.map((t) => <li key={t} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />{t}</li>)}
                  </ul>
                </div>
              )}
              <Link href={`/stocks/${c.ticker}`} className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">See all its numbers</Link>
            </Panel>
          ))}
          {!!state.more && <p className="text-sm text-slate-500">The message names {state.more} more {state.more > 1 ? "companies" : "company"}. Check them one at a time.</p>}

          <p className="text-xs leading-relaxed text-slate-500">These checks read the words and the company&apos;s numbers only. No red flags doesn&apos;t make something a good buy, and a red flag doesn&apos;t mean it will fall.</p>
        </section>
      )}
    </>
  );
}

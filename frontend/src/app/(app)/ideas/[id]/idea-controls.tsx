"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdeaRules, PlanLine } from "@/lib/rules";
import { addPlanToPortfolio, deleteIdea, saveStarterIdea } from "../actions";

/** Split calculator: the student picks the companies and the amount; we only do the arithmetic. */
export function BudgetForm({ budget, options, chosen }: { budget: number; options: { ticker: string; name: string }[]; chosen: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const [value, setValue] = useState(budget ? String(budget) : "");
  const [picked, setPicked] = useState<string[]>(chosen);
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const submit = () => {
    const q = new URLSearchParams({ budget: String(Math.max(0, Math.round(Number(value) || 0))) });
    if (picked.length !== options.length) q.set("only", picked.join(","));
    router.replace(`${path}?${q}`);
  };
  return (
    <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <fieldset>
        <legend className="text-sm text-slate-600 mb-2">Companies to include</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o.ticker} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50">
              <input type="checkbox" checked={picked.includes(o.ticker)} onChange={() => toggle(o.ticker)} className="accent-indigo-600" />
              {o.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="budget" className="text-sm text-slate-600">Amount</label>
        <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2 h-10 focus-within:ring-2 focus-within:ring-indigo-400">
          <span className="text-slate-400">₹</span>
          <input id="budget" type="number" min={0} step={100} value={value} onChange={(e) => setValue(e.target.value)} className="w-28 bg-transparent px-1 outline-none" placeholder="5000" />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="h-10 rounded-xl" disabled={!picked.length}>Split it</Button>
        {!picked.length && <span className="text-sm text-slate-500">Tick at least one company.</span>}
      </div>
    </form>
  );
}

export function BoughtButton({ lines }: { lines: PlanLine[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ added?: number; error?: string } | null>(null);
  if (result?.added) {
    return <p className="text-sm text-emerald-700 flex items-center gap-2"><Check className="h-4 w-4" />Added {result.added} holdings. <Link href="/portfolio" className="underline">See your portfolio</Link></p>;
  }
  return (
    <div>
      <Button variant="outline" className="rounded-xl" disabled={pending || !lines.length}
        onClick={() => start(async () => setResult(await addPlanToPortfolio(lines.map(({ ticker, shares, price }) => ({ ticker, shares, price })))))}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}I&apos;ve bought these: add to my portfolio
      </Button>
      {result?.error && <p className="mt-2 text-sm text-rose-600">{result.error}</p>}
    </div>
  );
}

export function SaveStarterButton({ rules }: { rules: IdeaRules }) {
  const [pending, start] = useTransition();
  return (
    <Button className="rounded-xl" disabled={pending} onClick={() => start(() => saveStarterIdea(rules))}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}Save this idea
    </Button>
  );
}

export function DeleteIdeaButton({ id }: { id: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return <Button variant="ghost" className="rounded-xl text-slate-500" onClick={() => setConfirming(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>;
  }
  return (
    <span className="flex items-center gap-2 text-sm text-slate-600">
      Delete this idea?
      <Button variant="destructive" size="sm" disabled={pending} onClick={() => start(() => deleteIdea(id))}>Yes, delete</Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
    </span>
  );
}

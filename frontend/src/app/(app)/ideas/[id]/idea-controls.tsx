"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdeaRules, PlanLine } from "@/lib/rules";
import { addPlanToPortfolio, deleteIdea, saveStarterIdea } from "../actions";

export function BudgetForm({ budget }: { budget: number }) {
  const router = useRouter();
  const path = usePathname();
  const [value, setValue] = useState(budget ? String(budget) : "");
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); router.replace(`${path}?budget=${Math.max(0, Math.round(Number(value) || 0))}`); }}>
      <label htmlFor="budget" className="text-sm text-slate-600">I want to invest</label>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2 h-10 focus-within:ring-2 focus-within:ring-indigo-400">
        <span className="text-slate-400">₹</span>
        <input id="budget" type="number" min={0} step={100} value={value} onChange={(e) => setValue(e.target.value)} className="w-28 bg-transparent px-1 outline-none" placeholder="5000" />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="h-10 rounded-xl">Update plan</Button>
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

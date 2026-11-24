"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createIdea, type IdeaFormState } from "./actions";

const EXAMPLES = [
  "I'm a student with ₹2,000 a month. I want safe, big companies I can hold for 5 years.",
  "Companies that pay regular dividends and don't have much debt",
  "Growing Indian companies in healthcare or IT, I can take some risk",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="rounded-2xl h-12 px-6">
      {pending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Finding matches…</> : <><Sparkles className="h-4 w-4 mr-2" />Find matching stocks</>}
    </Button>
  );
}

export function IdeaForm({ defaultPrompt = "", aiReady }: { defaultPrompt?: string; aiReady: boolean }) {
  const [state, action] = useActionState<IdeaFormState, FormData>(createIdea, {});
  return (
    <form action={action} className="space-y-4">
      <label htmlFor="prompt" className="block text-sm font-semibold text-slate-700">What do you want from your money?</label>
      <textarea
        id="prompt"
        name="prompt"
        required
        minLength={8}
        rows={3}
        defaultValue={defaultPrompt}
        placeholder={EXAMPLES[0]}
        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.slice(1).map((e) => (
          <button key={e} type="button" className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            onClick={(ev) => { const t = (ev.currentTarget.form?.elements.namedItem("prompt") as HTMLTextAreaElement); t.value = e; t.focus(); }}>
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label htmlFor="budget" className="block text-sm font-semibold text-slate-700">How much to invest (optional)</label>
          <div className="mt-1 flex items-center rounded-2xl border border-slate-200 bg-white/80 px-3 h-12 shadow-sm focus-within:ring-2 focus-within:ring-indigo-400">
            <span className="text-slate-400">₹</span>
            <input id="budget" name="budget" type="number" min={0} step={100} placeholder="5000" className="w-32 bg-transparent px-2 text-base outline-none" />
          </div>
        </div>
        <Submit />
      </div>
      {!aiReady && <p className="text-sm text-amber-700">The AI helper isn&apos;t set up yet, so typed ideas won&apos;t work. The ready-made ideas below work without it.</p>}
      {state.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}

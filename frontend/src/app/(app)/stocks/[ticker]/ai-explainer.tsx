import { unstable_cache } from "next/cache";
import { Sparkles } from "lucide-react";
import { aiAvailable, askJson, factsOnly } from "@/lib/llm";

const SYSTEM = `You explain an Indian listed company to a student who is new to investing.
Write exactly 3 short sentences in plain English (no jargon, under 25 words each):
1. What the company does. If you are not sure, say only which industry it is in.
2. What its numbers show, using only the facts given.
3. One thing worth keeping an eye on, taken from the facts given.
Never tell the reader to buy, sell or hold, never give a price target, never predict the price, and never call it a good or bad investment.
Reply as JSON: {"lines": ["...", "...", "..."]}`;

// one AI call per company per day of data; the key includes the dates so new numbers mean a new explanation
const explain = unstable_cache(
  async (stockId: number, dataDate: string, facts: string): Promise<string[]> => {
    const raw = await askJson<{ lines?: unknown }>([{ role: "system", content: SYSTEM }, { role: "user", content: facts }], { timeoutMs: 15_000 });
    const lines = factsOnly(raw?.lines, 3);
    if (!lines) throw new Error("AI explainer: no usable lines"); // thrown, so it isn't cached and the next view tries again
    return lines;
  },
  ["ai-explainer-v1"],
  { revalidate: 86400 },
);

/** "In 3 lines", written by AI from the facts on the page. Renders nothing when AI is off or fails. */
export async function AiExplainer({ stockId, dataDate, facts }: { stockId: number; dataDate: string; facts: string[] }) {
  if (!aiAvailable()) return null;
  const lines = await explain(stockId, dataDate, facts.join("\n")).catch((e: Error) => { console.error(e.message); return null; });
  if (!lines) return null;
  return (
    <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Sparkles className="h-4 w-4" aria-hidden />In 3 lines</p>
      <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-slate-800">
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Written by AI from the numbers on this page. It can be wrong; check the numbers below.</p>
    </div>
  );
}

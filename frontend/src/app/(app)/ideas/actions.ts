"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { askJson, AiUnavailableError, softenAdvice } from "@/lib/llm";
import { METRICS, METRIC_KEYS } from "@/lib/metrics";
import { sanitizeRules, type IdeaRules, type PlanLine } from "@/lib/rules";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { supabase, user };
}

const metricGuide = METRIC_KEYS.map((k) => {
  const m = METRICS[k];
  const unit = m.unit === "pct" ? "decimal, 0.15 = 15%" : m.unit === "crore" ? "₹ crore" : m.unit;
  return `- ${k} (${m.label}; ${unit}): ${m.explain}`;
}).join("\n");

function systemPrompt(sectors: string[], risk: string) {
  return `You turn a person's investing idea into screening rules for Indian stocks (Nifty 500).
The person may be a student or first-time investor. Their risk comfort: ${risk}.

Available metrics:
${metricGuide}

Sectors (use exact names only): ${sectors.join(", ")}

Return ONLY a JSON object:
{
  "name": "short friendly name, max 5 words",
  "summary": "2 plain sentences: what kind of companies these are and why they fit the idea. No jargon.",
  "filters": [{"metric": "<metric>", "op": ">" or "<", "value": <number in the metric's unit>}],
  "sectors_include": [], "sectors_exclude": [],
  "rank_by": [{"metric": "<metric>", "prefer": "high" or "low", "weight": 1}],
  "count": 6,
  "risks": ["2-3 honest, plain risks of this idea"],
  "note": "optional: one honest sentence if stocks are a poor fit for this money (e.g. needed within 1-2 years, emergency money), else empty"
}

Rules:
- 1 to 4 filters, loose enough that at least 10 companies pass. 1 to 3 rank_by entries.
- Cautious people: prefer bigger companies (market_cap_cr > 20000), low debt, low volatility_30d.
- count between 4 and 10.
- Never say "buy", "sell", "guaranteed" or "recommend". Describe what fits the idea.`;
}

export type IdeaFormState = { error?: string };

export async function createIdea(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 1000);
  const budget = Math.max(0, Math.round(Number(formData.get("budget")) || 0));
  if (prompt.length < 8) return { error: "Tell us a little more about what you want (a sentence is enough)." };

  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: sectorRows }] = await Promise.all([
    supabase.from("user_profiles").select("risk_appetite").eq("user_id", user.id).maybeSingle(),
    supabase.from("stock_snapshot").select("sector"),
  ]);
  const sectors = Array.from(new Set((sectorRows ?? []).map((r) => r.sector as string))).sort();

  let rules: IdeaRules | null = null;
  try {
    const raw = await askJson([
      { role: "system", content: systemPrompt(sectors, profile?.risk_appetite ?? "moderate") },
      { role: "user", content: prompt },
    ]);
    rules = sanitizeRules(raw, sectors);
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      console.error(e.message);
      return { error: "Our AI helper is unavailable right now. Pick one of the ready-made ideas below meanwhile." };
    }
    throw e;
  }
  if (!rules) return { error: "We couldn't turn that into clear rules. Try saying what matters to you, e.g. “safe, big companies that pay dividends”." };
  rules.summary = softenAdvice(rules.summary);
  rules.risks = rules.risks.map(softenAdvice);

  const id = await insertIdea(supabase, user.id, rules, prompt);
  redirect(`/ideas/${id}${budget ? `?budget=${budget}` : ""}`);
}

async function insertIdea(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, rules: IdeaRules, prompt: string) {
  const { data, error } = await supabase
    .from("strategies")
    .insert({ user_id: userId, name: rules.name, description: rules.summary, user_prompt: prompt, rules_json: rules, universe: "nifty500", status: "draft", strategy_type: "idea" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save the idea: ${error?.message}`);
  revalidatePath("/ideas");
  revalidatePath("/home");
  return data.id as number;
}

export async function saveStarterIdea(rules: IdeaRules) {
  const { supabase, user } = await requireUser();
  const clean = sanitizeRules(rules, Array.from(new Set([...rules.sectors_include, ...rules.sectors_exclude])));
  if (!clean) throw new Error("Invalid idea");
  const id = await insertIdea(supabase, user.id, clean, "");
  redirect(`/ideas/${id}`);
}

export async function deleteIdea(id: number) {
  const { supabase } = await requireUser();
  await supabase.from("strategies").delete().eq("id", id); // RLS limits this to the owner's rows
  revalidatePath("/ideas");
  revalidatePath("/home");
  redirect("/ideas");
}

/** "I bought these": record the plan in the user's portfolio at today's prices. */
export async function addPlanToPortfolio(lines: Pick<PlanLine, "ticker" | "shares" | "price">[]) {
  const { supabase, user } = await requireUser();
  const valid = lines.filter((l) => Number.isInteger(l.shares) && l.shares > 0 && l.price > 0).slice(0, 20);
  if (!valid.length) return { error: "Nothing to add." };
  const { data: stocks } = await supabase.from("stocks").select("id, ticker").in("ticker", valid.map((l) => l.ticker));
  const idOf = new Map((stocks ?? []).map((s) => [s.ticker as string, s.id as number]));
  const today = new Date().toISOString().slice(0, 10);
  const rows = valid.filter((l) => idOf.has(l.ticker)).map((l) => ({
    user_id: user.id, stock_id: idOf.get(l.ticker), quantity: l.shares, avg_buy_price: l.price, acquired_date: today, source: "idea",
  }));
  const { error } = await supabase.from("holdings").insert(rows);
  if (error) return { error: `Could not add to portfolio: ${error.message}` };
  revalidatePath("/portfolio");
  revalidatePath("/home");
  return { added: rows.length };
}

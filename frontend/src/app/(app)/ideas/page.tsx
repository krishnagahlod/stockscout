import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { aiAvailable } from "@/lib/llm";
import { STARTER_IDEAS } from "@/lib/starter-ideas";
import { niceDate } from "@/lib/format";
import { Empty, PageTitle, Panel } from "@/components/kit";
import { IdeaForm } from "./idea-form";

export const metadata = { title: "Ideas | StockScout" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: saved } = await supabase
    .from("strategies")
    .select("id, name, description, created_at, rules_json")
    .order("created_at", { ascending: false })
    .limit(30);
  const ideas = (saved ?? []).filter((s) => s.rules_json?.version === 2); // older strategy formats aren't shown

  return (
    <div className="max-w-5xl mx-auto">
      <PageTitle title="Ideas" subtitle="Say what you want in your own words. We find Nifty 500 companies that fit, explain why, and show how to split your money." />

      <Panel className="mb-8">
        <IdeaForm defaultPrompt={q ?? ""} aiReady={aiAvailable()} />
      </Panel>

      <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Or start with a ready-made idea</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {STARTER_IDEAS.map((s) => (
          <Link key={s.slug} href={`/ideas/s-${s.slug}`} className="glass-card rounded-3xl p-5 transition hover:shadow-premium-hover">
            <div className="text-2xl" aria-hidden>{s.emoji}</div>
            <p className="mt-2 font-semibold text-slate-900">{s.name}</p>
            <p className="mt-1 text-sm text-slate-500">{s.tagline}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Your saved ideas</h2>
      {ideas.length === 0 ? (
        <Empty title="No saved ideas yet">Describe one above, or open a ready-made idea and save it.</Empty>
      ) : (
        <div className="space-y-3">
          {ideas.map((i) => (
            <Link key={i.id} href={`/ideas/${i.id}`} className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:shadow-premium-hover">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{i.name}</p>
                <p className="text-sm text-slate-500 truncate">{i.description}</p>
              </div>
              <span className="text-xs text-slate-400 hidden sm:block">{niceDate(i.created_at)}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

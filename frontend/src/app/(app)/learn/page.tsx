import Link from "next/link";
import { LESSONS } from "@/lib/lessons";
import { PageTitle } from "@/components/kit";

export const metadata = { title: "Learn | StockScout" };

export default function LearnPage() {
  const groups = Array.from(new Set(LESSONS.map((l) => l.group)));
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageTitle title="Learn" subtitle="Two-minute lessons, in plain words, on the things that matter most when you start." />
      {groups.map((g) => (
        <section key={g}>
          <h2 className="font-display text-lg font-bold text-slate-900">{g}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {LESSONS.filter((l) => l.group === g).map((l) => (
              <li key={l.slug}>
                <Link href={`/learn/${l.slug}`} className="glass-card block h-full rounded-2xl p-4 hover:shadow-premium-hover">
                  <p className="font-semibold text-slate-900">{l.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{l.oneLine}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

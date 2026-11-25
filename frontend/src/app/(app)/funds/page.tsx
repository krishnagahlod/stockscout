import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { FUND_GROUPS, groupOf, type Fund } from "@/lib/funds";
import { niceDate } from "@/lib/format";
import { Change, Empty, PageTitle, Panel } from "@/components/kit";

export const metadata = { title: "Mutual funds | StockScout" };

const COLS = "scheme_code, name, amc, category, nav, nav_date, ret_1y, ret_3y, ret_5y, worst_fall_5y";
const SORTS = { name: "Name", ret_1y: "1 year", ret_3y: "3 years, a year", ret_5y: "5 years, a year", worst_fall_5y: "Worst fall, 5 years" } as const;
type SortKey = keyof typeof SORTS;

async function allFunds(): Promise<Fund[]> {
  const supabase = await createClient();
  const out: Fund[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase.from("funds").select(COLS).order("scheme_code").range(from, from + 999);
    if (error) throw new Error(`Could not load funds: ${error.message}`);
    out.push(...((data ?? []) as Fund[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const pctOrDash = (v: number | null) => (v == null ? <span className="text-slate-400">—</span> : <Change value={v} />);

export default async function FundsPage({ searchParams }: { searchParams: Promise<{ group?: string; q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const funds = await allFunds();
  const group = FUND_GROUPS.find((g) => g.id === sp.group);
  const q = sp.q?.trim().toLowerCase().slice(0, 60) ?? "";
  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "name";
  const asOf = funds.reduce<string | null>((a, f) => (f.nav_date && (!a || f.nav_date > a) ? f.nav_date : a), null);

  const searchBox = (
    <form className="flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10 focus-within:ring-2 focus-within:ring-indigo-400">
      <Search className="h-4 w-4 text-slate-400" aria-hidden />
      <label htmlFor="fund-q" className="sr-only">Search funds</label>
      <input id="fund-q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by fund or company, e.g. Nifty 50, Parag Parikh" className="w-full bg-transparent text-sm outline-none" />
    </form>
  );

  if (!group && !q) {
    const counts = new Map<string, number>();
    funds.forEach((f) => counts.set(groupOf(f.category).id, (counts.get(groupOf(f.category).id) ?? 0) + 1));
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageTitle title="Mutual funds" subtitle={`${funds.length.toLocaleString("en-IN")} funds from AMFI, Direct plan and Growth option only${asOf ? `, NAVs as of ${niceDate(asOf)}` : ""}.`} />
        {searchBox}
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FUND_GROUPS.map((g) => (
            <li key={g.id}>
              <Link href={`/funds?group=${g.id}`} className="glass-card block h-full rounded-3xl p-5 hover:shadow-premium-hover">
                <p className="font-display text-lg font-bold text-slate-900">{g.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{g.holds}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-slate-500">Ups and downs</dt><dd className="font-medium text-slate-800">{g.ups}</dd></div>
                  <div><dt className="text-slate-500">Usually for</dt><dd className="font-medium text-slate-800">{g.horizon}</dd></div>
                </dl>
                <p className="mt-3 text-sm font-semibold text-indigo-600">{counts.get(g.id) ?? 0} funds</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">StockScout earns nothing from any fund. Fund lists are information, not recommendations.</p>
      </div>
    );
  }

  let list = funds.filter((f) => (group ? groupOf(f.category).id === group.id : true) && (!q || `${f.name} ${f.amc ?? ""}`.toLowerCase().includes(q)));
  list = [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)));
  const shown = list.slice(0, 300);
  const link = (s: SortKey) => `/funds?${new URLSearchParams({ ...(group ? { group: group.id } : {}), ...(sp.q ? { q: sp.q } : {}), sort: s })}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/funds" className="text-sm text-slate-500 hover:text-indigo-600">All fund groups</Link>
      <PageTitle title={group ? group.title : `Funds matching “${sp.q}”`} subtitle={group ? `${group.holds} Ups and downs: ${group.ups.toLowerCase()}. Usually for ${group.horizon.toLowerCase()}.` : undefined} />
      {searchBox}
      {shown.length === 0 ? <Empty title="No funds found">Try a shorter name, like the fund house (&ldquo;HDFC&rdquo;) or the index (&ldquo;Nifty 50&rdquo;).</Empty> : (
        <Panel>
          <p className="text-sm text-slate-500">{list.length} funds{list.length > shown.length ? `, first ${shown.length} shown` : ""}. Tap a column to sort; past returns don&apos;t promise future ones.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  {(Object.keys(SORTS) as SortKey[]).map((k) => (
                    <th key={k} className={`py-2 font-medium ${k === "name" ? "" : "text-right"}`} aria-sort={sort === k ? (k === "name" ? "ascending" : "descending") : undefined}>
                      <Link href={link(k)} className={sort === k ? "text-indigo-700" : "hover:text-slate-800"}>{SORTS[k]}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.scheme_code} className="border-b border-slate-50">
                    <td className="py-2 pr-3"><Link href={`/funds/${f.scheme_code}`} className="font-medium text-slate-900 hover:text-indigo-600">{f.name}</Link><span className="block text-xs text-slate-400">{f.amc}</span></td>
                    <td className="py-2 text-right">{pctOrDash(f.ret_1y)}</td>
                    <td className="py-2 text-right">{pctOrDash(f.ret_3y)}</td>
                    <td className="py-2 text-right">{pctOrDash(f.ret_5y)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{f.worst_fall_5y != null ? `−${Math.round(-f.worst_fall_5y * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

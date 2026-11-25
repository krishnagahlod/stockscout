import { createClient } from "@/utils/supabase/server";
import { getPriceHistory } from "@/lib/market";
import { grownFrom, monthsBetween, rolling, worstFall } from "@/lib/risk";
import { yearChange, type StockSnapshot } from "@/lib/metrics";
import { shortTicker } from "@/lib/format";
import { StartFlow, type FundRow, type NiftyFacts } from "./start-flow";

export const metadata = { title: "Start here | StockScout" };

export default async function StartPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_snapshot").select("*").in("sector", ["ETF", "Index"]);
  const rows = (data ?? []) as StockSnapshot[];
  const nifty = rows.find((r) => r.ticker === "^NSEI");
  const history = nifty ? await getPriceHistory(nifty.stock_id, 12) : [];

  let facts: NiftyFacts | null = null;
  const fall = worstFall(history);
  const last = history[history.length - 1];
  if (nifty && last && fall) {
    const tenYearsAgo = `${Number(last.date.slice(0, 4)) - 10}${last.date.slice(4)}`;
    facts = {
      asOf: last.date,
      since: history[0].date,
      grown: grownFrom(history, tenYearsAgo, 10000),
      fall,
      recoveryMonths: fall.recoveredDate ? monthsBetween(fall.troughDate, fall.recoveredDate) : null,
      oneYear: rolling(history, 1),
      fiveYear: rolling(history, 5),
    };
  }

  const funds: FundRow[] = rows
    .filter((r) => r.sector === "ETF" && r.price != null)
    .map((r) => ({
      ticker: shortTicker(r.ticker),
      name: r.name,
      follows: r.industry ?? "",
      price: r.price,
      priceDate: r.price_date,
      year: yearChange(r),
      worstYear: r.max_drawdown_1y,
    }));

  return <StartFlow facts={facts} funds={funds} />;
}

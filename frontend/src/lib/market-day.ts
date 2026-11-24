// "Market today" from our own end-of-day snapshot: breadth, sector moves (size-weighted) and big movers.
import { dayChange, type StockSnapshot } from "./metrics";

export type SectorMove = { name: string; change: number; count: number; rose: number; best: StockSnapshot; worst: StockSnapshot };

export function marketDay(universe: StockSnapshot[], bigCompanyCr = 20000) {
  const moved = universe.filter((s) => dayChange(s) != null && s.price_date);
  const date = moved.reduce<string | null>((a, s) => (!a || s.price_date! > a ? s.price_date! : a), null);
  const today = moved.filter((s) => s.price_date === date);
  const ch = (s: StockSnapshot) => dayChange(s) as number;

  const bySector = new Map<string, StockSnapshot[]>();
  today.forEach((s) => bySector.set(s.sector, [...(bySector.get(s.sector) ?? []), s]));
  const sectors: SectorMove[] = [...bySector].map(([name, list]) => {
    const weight = list.reduce((a, s) => a + (s.market_cap_cr ?? 0), 0);
    const change = weight ? list.reduce((a, s) => a + ch(s) * (s.market_cap_cr ?? 0), 0) / weight : list.reduce((a, s) => a + ch(s), 0) / list.length;
    const sorted = [...list].sort((a, b) => ch(b) - ch(a));
    return { name, change, count: list.length, rose: list.filter((s) => ch(s) > 0).length, best: sorted[0], worst: sorted[sorted.length - 1] };
  }).sort((a, b) => b.change - a.change);

  const big = today.filter((s) => (s.market_cap_cr ?? 0) >= bigCompanyCr).sort((a, b) => ch(b) - ch(a));
  const withAvg = universe.filter((s) => s.price != null && s.sma_200 != null);
  const withRange = universe.filter((s) => s.price != null && s.week_52_high && s.week_52_low);
  return {
    date,
    count: today.length,
    rose: today.filter((s) => ch(s) > 0).length,
    fell: today.filter((s) => ch(s) < 0).length,
    sectors,
    up: big.filter((s) => ch(s) > 0).slice(0, 5),
    down: big.filter((s) => ch(s) < 0).reverse().slice(0, 5),
    above200: withAvg.length ? withAvg.filter((s) => s.price! > s.sma_200!).length / withAvg.length : null,
    nearHigh: withRange.filter((s) => s.price! >= s.week_52_high! * 0.97).length,
    nearLow: withRange.filter((s) => s.price! <= s.week_52_low! * 1.03).length,
  };
}

import { dayChange, type StockSnapshot } from "./metrics";

export type HoldingRow = { id: number; stock_id: number; quantity: number; avg_buy_price: number };

export type Position = {
  stock: StockSnapshot;
  lotIds: number[];
  quantity: number;
  invested: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayPnl: number;
  weight: number;
};

export type Check = { tone: "good" | "warn"; title: string; detail: string };

export function summarize(holdings: HoldingRow[], snaps: Map<number, StockSnapshot>) {
  const byStock = new Map<number, Position>();
  for (const h of holdings) {
    const stock = snaps.get(h.stock_id);
    if (!stock || !stock.price) continue;
    const p = byStock.get(h.stock_id) ?? { stock, lotIds: [], quantity: 0, invested: 0, value: 0, pnl: 0, pnlPct: 0, dayPnl: 0, weight: 0 };
    p.lotIds.push(h.id);
    p.quantity += Number(h.quantity);
    p.invested += Number(h.quantity) * Number(h.avg_buy_price);
    byStock.set(h.stock_id, p);
  }
  const positions = Array.from(byStock.values());
  for (const p of positions) {
    p.value = p.quantity * (p.stock.price as number);
    p.pnl = p.value - p.invested;
    p.pnlPct = p.invested ? p.pnl / p.invested : 0;
    const dc = dayChange(p.stock);
    p.dayPnl = dc == null ? 0 : p.value - p.value / (1 + dc);
  }
  const value = positions.reduce((a, p) => a + p.value, 0);
  const invested = positions.reduce((a, p) => a + p.invested, 0);
  const dayPnl = positions.reduce((a, p) => a + p.dayPnl, 0);
  positions.forEach((p) => (p.weight = value ? p.value / value : 0));
  positions.sort((a, b) => b.value - a.value);

  const sectorMap = new Map<string, number>();
  positions.forEach((p) => sectorMap.set(p.stock.sector, (sectorMap.get(p.stock.sector) ?? 0) + p.value));
  const sectors = Array.from(sectorMap, ([name, v]) => ({ name, value: v, weight: value ? v / value : 0 })).sort((a, b) => b.value - a.value);

  return {
    positions,
    sectors,
    value,
    invested,
    pnl: value - invested,
    pnlPct: invested ? (value - invested) / invested : 0,
    dayPnl,
    dayPct: value - dayPnl ? dayPnl / (value - dayPnl) : 0,
    unpriced: holdings.filter((h) => !snaps.get(h.stock_id)?.price).length,
    checks: healthChecks(positions, sectors),
  };
}

/** Simple, explainable checks a first-time investor can act on. */
export function healthChecks(positions: Position[], sectors: { name: string; weight: number }[]): Check[] {
  if (!positions.length) return [];
  const checks: Check[] = [];
  const top = positions[0];
  if (top.weight > 0.25) {
    checks.push({ tone: "warn", title: `${Math.round(top.weight * 100)}% is in one company`, detail: `${top.stock.name} is a big part of your money. If it has a bad year, your whole portfolio feels it. Many people keep any one company under 20–25%.` });
  }
  if (sectors[0] && sectors[0].weight > 0.4 && sectors.length > 0) {
    checks.push({ tone: "warn", title: `${Math.round(sectors[0].weight * 100)}% is in ${sectors[0].name}`, detail: "Companies in the same industry often rise and fall together. Spreading across industries smooths the ride." });
  }
  if (positions.length < 5) {
    checks.push({ tone: "warn", title: `Only ${positions.length} ${positions.length === 1 ? "company" : "companies"}`, detail: "With few companies, one surprise matters a lot. 8–15 companies across different industries is a common starting point, or an index fund." });
  }
  const bigLosers = positions.filter((p) => p.pnlPct < -0.3);
  if (bigLosers.length) {
    checks.push({ tone: "warn", title: `${bigLosers.length} holding${bigLosers.length > 1 ? "s are" : " is"} down more than 30%`, detail: `${bigLosers.slice(0, 3).map((p) => p.stock.name).join(", ")}. Worth checking whether the reason you bought still holds, rather than deciding on the price alone.` });
  }
  const heavyDebt = positions.filter((p) => p.stock.sector !== "Financial Services" && (p.stock.debt_to_equity ?? 0) > 1.5);
  if (heavyDebt.length) {
    checks.push({ tone: "warn", title: `${heavyDebt.length} ${heavyDebt.length > 1 ? "companies borrow" : "company borrows"} heavily`, detail: `${heavyDebt.slice(0, 3).map((p) => p.stock.name).join(", ")} owe more than 1.5× their own money. That can hurt when interest rates rise or business slows.` });
  }
  if (!checks.length) {
    checks.push({ tone: "good", title: "Nicely spread out", detail: "No single company or industry dominates, and nothing is badly down. Keep adding regularly and review every few months." });
  }
  return checks;
}

// Practice mode: positions and cash are replayed from the user's practice trades (average-cost method).
import type { HoldingRow } from "./portfolio";

export const PRACTICE_CASH = 100000;
export type Trade = { id: number; stock_id: number; quantity: number; price: number; traded_at: string };

export function replay(trades: Trade[]): { holdings: HoldingRow[]; cash: number; realized: number } {
  const pos = new Map<number, { qty: number; cost: number }>();
  let cash = PRACTICE_CASH;
  let realized = 0;
  const ordered = [...trades].sort((a, b) => (a.traded_at === b.traded_at ? a.id - b.id : a.traded_at < b.traded_at ? -1 : 1));
  for (const t of ordered) {
    const p = pos.get(t.stock_id) ?? { qty: 0, cost: 0 };
    const price = Number(t.price);
    if (t.quantity > 0) {
      p.qty += t.quantity;
      p.cost += t.quantity * price;
      cash -= t.quantity * price;
    } else {
      const sold = Math.min(-t.quantity, p.qty); // never sell more than was held
      const avg = p.qty ? p.cost / p.qty : 0;
      realized += sold * (price - avg);
      cash += sold * price;
      p.cost -= sold * avg;
      p.qty -= sold;
    }
    pos.set(t.stock_id, p);
  }
  const holdings = [...pos.entries()]
    .filter(([, p]) => p.qty > 0)
    .map(([stock_id, p]) => ({ id: stock_id, stock_id, quantity: p.qty, avg_buy_price: p.cost / p.qty }));
  return { holdings, cash, realized };
}

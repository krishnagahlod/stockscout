// "If you sold today": capital gains tax estimate on listed shares and equity ETFs, as an explainer, not filing advice.
// shortcut: rates are the July 2024 budget's (20% short-term, 12.5% long-term above ₹1.25 lakh, 4% cess) and
// ignore surcharge, grandfathering and debt funds; update when the rules change.
export const TAX = { stcg: 0.2, ltcg: 0.125, exemption: 125000, cess: 0.04 };

export type Lot = { name: string; quantity: number; buyPrice: number; boughtOn: string | null; price: number };

function longTerm(boughtOn: string | null, today: string): boolean {
  if (!boughtOn) return false; // unknown dates count as short-term, the higher rate
  const [y, m, d] = boughtOn.split("-").map(Number);
  const yearLater = `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return today > yearLater; // held for more than 12 months
}

export function taxIfSoldToday(lots: Lot[], today: string) {
  const rows = lots.map((l) => ({ ...l, gain: (l.price - l.buyPrice) * l.quantity, long: longTerm(l.boughtOn, today) }));
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, r) => a + r.gain, 0);
  let st = sum((r) => !r.long);
  let lt = sum((r) => r.long);
  // a net short-term loss can be set off against long-term gains; a net long-term loss only carries forward
  if (st < 0) { lt += st; st = 0; }
  const ltTaxable = Math.max(0, lt - TAX.exemption);
  const tax = (st * TAX.stcg + ltTaxable * TAX.ltcg) * (1 + TAX.cess);
  return {
    rows,
    shortGain: sum((r) => !r.long),
    longGain: sum((r) => r.long),
    exemptionUsed: Math.min(Math.max(0, lt), TAX.exemption),
    tax: Math.max(0, tax),
    unknownDates: lots.filter((l) => !l.boughtOn).length,
  };
}

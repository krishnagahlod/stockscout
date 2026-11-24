import { yearChange, type StockSnapshot } from "./metrics";

export type Verdict = { label: string; tone: "good" | "ok" | "weak" | "unknown"; text: string };

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const isLender = (s: StockSnapshot) => s.sector === "Financial Services"; // banks borrow by design

export function businessVerdict(s: StockSnapshot): Verdict {
  const { roe, debt_to_equity: de, net_margin: nm } = s;
  if (roe == null) return { label: "Not enough data", tone: "unknown", text: "We don't have recent profit numbers for this company." };
  const roeTxt = `Makes ${(roe * 100).toFixed(0)}% a year on its owners' money`;
  const debtTxt = de == null || isLender(s) ? "" : de < 0.5 ? ", with little debt" : de > 1.5 ? ", but borrows heavily" : ", with moderate debt";
  const marginTxt = nm != null ? ` Keeps ₹${Math.round(nm * 100)} of every ₹100 of sales as profit.` : "";
  const heavyDebt = !isLender(s) && de != null && de > 1.5;
  if (roe >= 0.15 && !heavyDebt) return { label: "Strong business", tone: "good", text: roeTxt + debtTxt + "." + marginTxt };
  if (roe < 0.08 || heavyDebt) return { label: "Weaker business", tone: "weak", text: roeTxt + debtTxt + "." + marginTxt };
  return { label: "Decent business", tone: "ok", text: roeTxt + debtTxt + "." + marginTxt };
}

export function priceVerdict(s: StockSnapshot, universe: StockSnapshot[]): Verdict {
  if (s.pe == null || s.pe <= 0) return { label: "Hard to judge", tone: "unknown", text: "No usable price-to-profit number (the company may be making a loss)." };
  const peers = universe.filter((u) => u.sector === s.sector && u.pe != null && u.pe > 0).map((u) => u.pe as number);
  const med = median(peers);
  if (med == null || peers.length < 4) return { label: "Hard to judge", tone: "unknown", text: `P/E is ${s.pe.toFixed(1)}, but there are too few similar companies to compare with.` };
  const ratio = s.pe / med;
  const base = `You pay ₹${s.pe.toFixed(0)} for every ₹1 of yearly profit; similar companies average ₹${med.toFixed(0)}.`;
  if (ratio < 0.8) return { label: "Cheaper than similar companies", tone: "good", text: base + " Cheaper can mean a bargain, or that investors expect trouble." };
  if (ratio > 1.25) return { label: "Pricier than similar companies", tone: "weak", text: base + " Investors expect faster growth; if it doesn't come, the price can fall." };
  return { label: "Priced like similar companies", tone: "ok", text: base };
}

export function trendVerdict(s: StockSnapshot): Verdict {
  const y = yearChange(s);
  const vol = s.volatility_30d;
  if (y == null) return { label: "Not enough history", tone: "unknown", text: "Less than a year of prices." };
  const move = `${y >= 0 ? "Up" : "Down"} ${Math.abs(y * 100).toFixed(0)}% over the past year`;
  const swings = vol == null ? "." : vol < 0.25 ? ", and the price has been calm lately." : vol > 0.4 ? ", and the price has been jumping around a lot." : ", with normal ups and downs.";
  const tone = y > 0.1 ? "good" : y < -0.15 ? "weak" : "ok";
  return { label: y > 0.1 ? "Rising" : y < -0.15 ? "Falling" : "Flat-ish", tone, text: move + swings };
}

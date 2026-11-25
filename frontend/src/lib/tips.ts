// Tip checker: hype phrases in a forwarded message, companies it names, and red flags from real numbers.
import type { StockSnapshot } from "./metrics";
import { rankOf } from "./glance";
import type { Point } from "./risk";

const HYPE: [RegExp, string][] = [
  [/sure[\s-]*shot/i, "sure shot"],
  [/multi[\s-]*bagger/i, "multibagger"],
  [/guarantee/i, "guaranteed"],
  [/jackpot/i, "jackpot"],
  [/upper\s*circuit/i, "upper circuit"],
  [/\boperators?\b/i, "operator"],
  [/\binsider/i, "insider"],
  [/(don'?t|do\s*not)\s*miss/i, "don't miss"],
  [/last\s*chance/i, "last chance"],
  [/\b(will|going\s*to|gonna|set\s*to|can|could)\s*(double|triple)|\b(double|triple)\s*(your|money|in|soon)/i, "double your money"],
  [/\d+\s*%\s*(return|profit|gain|upside)/i, "promised % return"],
  [/\b\d+\s*x\s*(return|profit|gain|in)/i, "promised multiple"],
  [/\b(tgt|targets?)\b/i, "target"],
  [/\bsl\b|stop[\s-]*loss/i, "stop-loss"],
  [/\b(vip|premium|paid)\s*(group|channel|tips?|members?)/i, "VIP or paid group"],
  [/telegram|whatsapp\s*(group|channel)/i, "Telegram or WhatsApp group"],
  [/\b(buy|enter|grab)\s*(now|today|immediately|fast|asap)\b/i, "buy now"],
  [/(risk[\s-]*free|no\s*risk|zero\s*risk)/i, "no risk"],
  [/(big|huge|major)\s*news|news\s*(coming|soon|tomorrow)/i, "big news coming"],
  [/[🚀💰🔥📈💸]/u, "hype emojis"],
];

export function hypeWords(text: string): string[] {
  return HYPE.filter(([re]) => re.test(text)).map(([, label]) => label);
}

// all-caps words common in tip messages that are not company tickers
const CAPS_STOP = new Set(("BUY SELL HOLD TARGET TARGETS TGT CMP NSE BSE SME IPO ALERT URGENT NOW TODAY FREE JOIN LIVE CALL CALLS STOCK STOCKS " +
  "MARKET NIFTY SENSEX BANKNIFTY FNO OPTION OPTIONS RS INR LTD LIMITED AND THE FOR WITH NEW BIG HIGH LOW ALL NOT YES BOOK PROFIT " +
  "ENTRY EXIT RETURN RETURNS MULTIBAGGER JACKPOT SURE SHOT GUARANTEED DONT MISS LAST CHANCE GROUP VIP PREMIUM TELEGRAM WHATSAPP " +
  "BREAKING NEWS UPDATE WOW OMG ROCKET MOON BULL BEAR BULLISH BEARISH LONG SHORT TERM DAY WEEK MONTH YEAR QTY AVG PRICE LEVEL " +
  "LEVELS SUPPORT RESISTANCE BREAKOUT INDIA SEBI RBI GDP USA FII DII ETF MUST WATCH HOT TIP TIPS ONLY FAST LOSS STRONG ADD ABOVE BELOW " +
  "NEAR UPPER LOWER CIRCUIT OPERATOR INSIDER ORDER ORDERS RESULT RESULTS NEXT HUGE MAJOR").split(" "));

const nameCore = (name: string) => name.replace(/\s+(Ltd\.?|Limited)$/i, "").trim();
const short = (ticker: string) => ticker.replace(/\.(NS|BO)$/i, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Companies named in the text: an all-caps ticker ("COALINDIA") or the full name without "Ltd." ("Coal India").
 * A short text (a few words) is treated as a search: the biggest company whose name or ticker contains it.
 * `unknown` lists all-caps words that look like tickers but aren't in the universe.
 */
export function findMentions(text: string, universe: StockSnapshot[]): { found: StockSnapshot[]; unknown: string[] } {
  const found = new Map<number, StockSnapshot>();
  const capsWords = new Set(text.match(/\b[A-Z][A-Z0-9&-]{2,14}\b/g) ?? []);
  const lower = text.toLowerCase();
  for (const s of universe) {
    const t = short(s.ticker);
    const core = nameCore(s.name);
    if (capsWords.has(t) || (core.length >= 4 && new RegExp(`\\b${escape(core.toLowerCase())}\\b`).test(lower))) found.set(s.stock_id, s);
  }
  const words = text.trim().split(/\s+/);
  if (!found.size && words.length <= 4) {
    const q = text.trim().toLowerCase();
    const hit = universe
      .filter((s) => short(s.ticker).toLowerCase() === q || s.name.toLowerCase().includes(q))
      .sort((a, b) => (b.market_cap_cr ?? 0) - (a.market_cap_cr ?? 0))[0];
    if (hit) found.set(hit.stock_id, hit);
  }
  const known = new Set(universe.map((s) => short(s.ticker)));
  // a word that is part of a company we matched ("JSW" in "JSW Steel") isn't a separate unknown name
  const inFound = (w: string) => [...found.values()].some((s) => new RegExp(`\\b${escape(w)}\\b`, "i").test(s.name));
  const unknown = [...capsWords].filter((w) => !known.has(w) && !CAPS_STOP.has(w) && /[A-Z]{3,}/.test(w) && !inFound(w));
  return { found: [...found.values()], unknown };
}

export type Flag = { level: "red" | "amber"; text: string };

/** Change from the close `sessions` trading days ago to the latest close. */
function changeOver(history: Point[], sessions: number): number | null {
  if (history.length <= sessions) return null;
  const then = history[history.length - 1 - sessions].close;
  return then > 0 ? history[history.length - 1].close / then - 1 : null;
}

const p0 = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
const isLender = (s: StockSnapshot) => s.sector === "Financial Services";

/** Red flags and reassuring facts for one company, from our own numbers only. */
export function tipFlags(s: StockSnapshot, universe: StockSnapshot[], history: (Point & { delivery_pct?: number | null })[], pledged: number | null = null): { flags: Flag[]; fine: string[] } {
  const flags: Flag[] = [];
  const fine: string[] = [];
  // pledged: fraction of the promoter group's own shares pledged for loans, from the latest shareholding filing
  if (pledged != null && pledged >= 0.25) flags.push({ level: "red", text: `The promoter group has pledged ${p0(pledged)} of its shares for loans. If the price falls, lenders can sell them and push it down further.` });
  else if (pledged != null && pledged >= 0.05) flags.push({ level: "amber", text: `The promoter group has pledged ${p0(pledged)} of its shares for loans.` });
  const nums = (pick: (u: StockSnapshot) => number | null) => universe.map(pick).filter((x): x is number => x != null);

  if (s.market_cap_cr != null) {
    const r = rankOf(nums((u) => u.market_cap_cr), s.market_cap_cr);
    if (r < 0.2) flags.push({ level: "amber", text: `One of the smallest 20% of Nifty 500 companies. Smaller companies' prices are easier to push around.` });
    else if (r >= 0.6) fine.push(`Big company: larger than ${Math.round(r * 100)}% of the Nifty 500.`);
  }

  const m1 = changeOver(history, 21);
  const m3 = changeOver(history, 63);
  if (m1 != null && m1 >= 0.25) flags.push({ level: "red", text: `Price up ${p0(m1)} in the past month. Tips spread after sharp jumps, and late buyers are the ones who get hurt.` });
  else if (m1 != null && m1 >= 0.15) flags.push({ level: "amber", text: `Price up ${p0(m1)} in the past month, a fast rise for a large company.` });
  if (m3 != null && m3 >= 0.6) flags.push({ level: "red", text: `Price up ${p0(m3)} in 3 months.` });
  const deliv = history.slice(-5).map((p) => p.delivery_pct).filter((v): v is number => v != null);
  const avgDeliv = deliv.length >= 3 ? deliv.reduce((a, v) => a + Number(v), 0) / deliv.length : null;
  if (m1 != null && m1 >= 0.15 && avgDeliv != null && avgDeliv < 30) {
    flags.push({ level: "red", text: `Most of the recent buying was same-day trading: only ${Math.round(avgDeliv)}% of shares traded in the last week were actually kept by buyers.` });
  }

  const om = s.operating_margin;
  if ((s.eps != null && s.eps < 0) || (s.net_margin != null && s.net_margin < 0)) flags.push({ level: "red", text: "Made a loss in the latest year we have." });
  else if (om != null && om < 0) flags.push({ level: "red", text: `Its day-to-day business lost money: ₹${Math.max(1, Math.round(-om * 100))} on every ₹100 of sales. Any profit it reports came from other items, such as one-off gains.` });
  else if (s.net_margin != null) fine.push(`Made a profit: ₹${Math.round(s.net_margin * 100)} of every ₹100 of sales.`);

  const de = s.debt_to_equity;
  if (!isLender(s) && de != null) {
    if (de > 2) flags.push({ level: "red", text: `Borrows heavily: ₹${de.toFixed(1)} of debt for every ₹1 of owners' money.` });
    else if (de > 1) flags.push({ level: "amber", text: `Fairly high borrowing: ₹${de.toFixed(1)} of debt for every ₹1 of owners' money.` });
    else if (de < 0.5) fine.push("Borrows little.");
  }

  if (s.pe != null && s.pe > 0) {
    const sector = universe.filter((u) => u.sector === s.sector && u.pe != null && u.pe > 0).map((u) => u.pe as number).sort((a, b) => a - b);
    const med = sector.length >= 4 ? sector[Math.floor(sector.length / 2)] : null;
    if (s.pe > 80 || (med != null && s.pe > med * 2.5)) {
      flags.push({ level: "amber", text: `Priced at ${Math.round(s.pe)} times its yearly profit${med ? `; similar companies are around ${Math.round(med)}` : ""}. High expectations are built in.` });
    }
  }

  if (s.volatility_30d != null && rankOf(nums((u) => u.volatility_30d), s.volatility_30d) >= 0.9) {
    flags.push({ level: "amber", text: "Its price swings are wilder than 90% of the Nifty 500 lately." });
  }
  if (s.max_drawdown_1y != null && s.max_drawdown_1y <= -0.4) {
    flags.push({ level: "amber", text: `Fell ${p0(s.max_drawdown_1y)} at one point in the past year.` });
  }

  return { flags: flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1)), fine };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function rupees(n: number | null | undefined, decimals = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${(decimals ? inr2 : inr).format(n)}`;
}

/** Crores in the way Indian readers say them: ₹12,500 Cr, ₹1.2 L Cr. */
export function crores(cr: number | null | undefined): string {
  if (cr == null || !Number.isFinite(cr)) return "—";
  if (cr >= 100_000) return `₹${(cr / 100_000).toFixed(1)} L Cr`;
  return `₹${inr.format(cr)} Cr`;
}

/** 0.153 -> "15.3%" */
export function pct(n: number | null | undefined, digits = 1, signed = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = `${(n * 100).toFixed(digits)}%`;
  return signed && n > 0 ? `+${s}` : s;
}

export function num(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function shortTicker(ticker: string): string {
  return ticker.replace(/\.(NS|BO)$/, "");
}

export function niceDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

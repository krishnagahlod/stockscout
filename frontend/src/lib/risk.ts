// "How bad can it get?" from real daily closes: the worst peak-to-bottom fall and how long recovery took.
export type Point = { date: string; close: number };
export type Fall = { fall: number; peakDate: string; peakClose: number; troughDate: string; recoveredDate: string | null };

/** Worst fall from a high to a later low, e.g. fall = -0.38 for a 38% drop. Null with under 2 points. */
export function worstFall(points: Point[]): Fall | null {
  if (points.length < 2) return null;
  let peak = points[0];
  let worst: Fall | null = null;
  for (const p of points) {
    if (p.close > peak.close) peak = p;
    const dd = p.close / peak.close - 1;
    if (!worst || dd < worst.fall) worst = { fall: dd, peakDate: peak.date, peakClose: peak.close, troughDate: p.date, recoveredDate: null };
  }
  if (!worst || worst.fall >= 0) return null;
  const back = points.find((p) => p.date > worst!.troughDate && p.close >= worst!.peakClose);
  return { ...worst, recoveredDate: back?.date ?? null };
}

/** Value now of `amount` put in at the first close on or after `since`. */
export function grownFrom(points: Point[], since: string, amount: number): { start: Point; value: number } | null {
  const start = points.find((p) => p.date >= since);
  const end = points[points.length - 1];
  if (!start || !end || start.close <= 0 || start === end) return null;
  return { start, value: (amount * end.close) / start.close };
}

/** Every `years`-long holding period in the data: worst and best return, and the share that lost money. */
export function rolling(points: Point[], years: number): { worst: number; best: number; lossShare: number; count: number } | null {
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    const target = `${Number(points[i].date.slice(0, 4)) + years}${points[i].date.slice(4)}`;
    while (j < points.length && points[j].date < target) j++;
    if (j >= points.length) break;
    out.push(points[j].close / points[i].close - 1);
  }
  if (!out.length) return null;
  return { worst: Math.min(...out), best: Math.max(...out), lossShare: out.filter((r) => r < 0).length / out.length, count: out.length };
}

/** Simple moving average of closes; null until `n` points are available. */
export function sma(points: Point[], n: number): (number | null)[] {
  let sum = 0;
  return points.map((p, i) => {
    sum += p.close - (i >= n ? points[i - n].close : 0);
    return i >= n - 1 ? sum / n : null;
  });
}

/** Whether the latest close is above its `n`-day average, and since which date that has been true. */
export function trendSince(points: Point[], n = 50): { above: boolean; since: string } | null {
  const avg = sma(points, n);
  const last = points.length - 1;
  if (last < 0 || avg[last] == null) return null;
  const above = points[last].close >= (avg[last] as number);
  let i = last;
  while (i > 0 && avg[i - 1] != null && points[i - 1].close >= (avg[i - 1] as number) === above) i--;
  return { above, since: points[i].date };
}

/** Months between two ISO dates, rounded. */
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

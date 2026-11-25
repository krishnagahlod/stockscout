"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, LineSeries, createChart } from "lightweight-charts";
import type { Point } from "@/lib/risk";

export const SERIES_COLORS = ["#4f46e5", "#d97706", "#0d9488"]; // validated categorical order; the Nifty is grey
const NIFTY = "#94a3b8";
const RANGES = { "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 } as const;
type Range = keyof typeof RANGES;

function monthsBefore(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Each line rebased to 100 on the first shared day, so climbs compare fairly. */
export function CompareChart({ series, nifty }: { series: { name: string; points: Point[] }[]; nifty: Point[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("1Y");

  const lines = useMemo(() => {
    const all = [...series.map((s, i) => ({ ...s, color: SERIES_COLORS[i] })), { name: "Nifty 50", points: nifty, color: NIFTY }].filter((s) => s.points.length > 1);
    const last = all.reduce((a, s) => (s.points[s.points.length - 1].date < a ? s.points[s.points.length - 1].date : a), "9999");
    const from = monthsBefore(last, RANGES[range]);
    const sets = all.map((s) => new Set(s.points.map((p) => p.date)));
    const start = all[0]?.points.find((p) => p.date >= from && sets.every((st) => st.has(p.date)))?.date;
    if (!start) return [];
    return all.map((s) => {
      const pts = s.points.filter((p) => p.date >= start && p.date <= last);
      const base = pts[0].close;
      return { ...s, data: pts.map((p) => ({ time: p.date, value: (p.close / base) * 100 })) };
    });
  }, [series, nifty, range]);

  useEffect(() => {
    if (!box.current || !lines.length) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#64748b", fontFamily: "inherit", attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { priceFormatter: (v: number) => v.toFixed(0) },
      handleScroll: false,
      handleScale: false,
    });
    lines.forEach((l) => chart.addSeries(LineSeries, { color: l.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(l.data));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {lines.map((l) => {
            const ch = l.data[l.data.length - 1].value / 100 - 1;
            return (
              <li key={l.name} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: l.color }} aria-hidden />
                <span className="text-slate-700">{l.name}</span>
                <span className="tabular-nums text-slate-500">{ch >= 0 ? "+" : "−"}{Math.abs(ch * 100).toFixed(1)}%</span>
              </li>
            );
          })}
        </ul>
        <div role="group" aria-label="Time range" className="inline-flex rounded-xl bg-slate-100 p-1">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${range === r ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{r}</button>
          ))}
        </div>
      </div>
      <div ref={box} className="mt-4 h-72" role="img" aria-label="Price of each company, starting at 100" />
      <p className="mt-2 text-xs text-slate-500">Every line starts at 100, so you can compare the climb, not the share price. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="hover:text-slate-700">Charts by TradingView</a></p>
    </div>
  );
}

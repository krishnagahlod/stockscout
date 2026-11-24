"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { sma, type Point } from "@/lib/risk";
import type { PricePoint } from "@/lib/market";

type Range = "3M" | "6M" | "1Y" | "5Y" | "All";
type View = "line" | "candles" | "compare";
const RANGES: Range[] = ["3M", "6M", "1Y", "5Y", "All"];
const MONTHS: Record<Range, number> = { "3M": 3, "6M": 6, "1Y": 12, "5Y": 60, All: 1200 };
const VIEWS: { id: View; label: string }[] = [{ id: "line", label: "Line" }, { id: "candles", label: "Candles" }, { id: "compare", label: "vs Nifty 50" }];
const RANGE_WORDS: Record<Range, string> = { "3M": "3 months", "6M": "6 months", "1Y": "1 year", "5Y": "5 years", All: "all our data" };
const COLORS = { stock: "#4f46e5", nifty: "#94a3b8", up: "#059669", down: "#e11d48", avg50: "#f59e0b", avg200: "#0ea5e9" };

function monthsBefore(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}
const signed = (x: number) => `${x >= 0 ? "up" : "down"} ${Math.abs(x * 100).toFixed(1)}%`;

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${value === o.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PriceChart({ data, benchmark, name, isIndex }: { data: PricePoint[]; benchmark: Point[]; name: string; isIndex?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("1Y");
  const [view, setView] = useState<View>("line");
  const [avgs, setAvgs] = useState(false);

  const last = data[data.length - 1]?.date ?? "";
  const from = last ? monthsBefore(last, MONTHS[range]) : "";
  // start at the last close on or before the cut date, the same rule as the "1 year" figure in the header
  const offset = useMemo(() => Math.max(0, data.findLastIndex((p) => p.date <= from)), [data, from]);
  const shown = useMemo(() => data.slice(offset), [data, offset]);
  const avg50 = useMemo(() => sma(data, 50), [data]);
  const avg200 = useMemo(() => sma(data, 200), [data]);

  // both rebased to 100 on the first day they share in the range
  const compare = useMemo(() => {
    const byDate = new Map(benchmark.map((b) => [b.date, b.close]));
    const start = shown.find((p) => byDate.has(p.date));
    if (!start) return null;
    const b0 = byDate.get(start.date)!;
    return {
      stock: shown.filter((p) => p.date >= start.date).map((p) => ({ time: p.date, value: (p.close / start.close) * 100 })),
      nifty: benchmark.filter((b) => b.date >= start.date && b.date <= last).map((b) => ({ time: b.date, value: (b.close / b0) * 100 })),
    };
  }, [shown, benchmark, last]);
  const canCompare = !isIndex && compare != null && compare.nifty.length > 1;
  const activeView: View = view === "compare" && !canCompare ? "line" : view;

  useEffect(() => {
    if (!box.current || shown.length < 2) return;
    const rupee = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#64748b", fontFamily: "inherit", attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { priceFormatter: activeView === "compare" ? (v: number) => v.toFixed(0) : isIndex ? (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : rupee },
      handleScroll: false,
      handleScale: false,
    });
    const quiet = { priceLineVisible: false, lastValueVisible: false } as const;

    if (activeView === "compare" && compare) {
      chart.addSeries(LineSeries, { color: COLORS.nifty, lineWidth: 2, ...quiet }).setData(compare.nifty);
      chart.addSeries(LineSeries, { color: COLORS.stock, lineWidth: 2, priceLineVisible: false }).setData(compare.stock);
    } else {
      if (activeView === "candles") {
        chart.addSeries(CandlestickSeries, { upColor: COLORS.up, downColor: COLORS.down, borderVisible: false, wickUpColor: COLORS.up, wickDownColor: COLORS.down, priceLineVisible: false })
          .setData(shown.map((p) => ({ time: p.date, open: p.open, high: p.high, low: p.low, close: p.close })));
        const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", ...quiet });
        vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        vol.setData(shown.filter((p) => p.volume != null && p.volume > 0).map((p) => ({
          time: p.date, value: p.volume as number, color: p.close >= p.open ? "rgba(5,150,105,0.25)" : "rgba(225,29,72,0.25)",
        })));
      } else {
        chart.addSeries(LineSeries, { color: COLORS.stock, lineWidth: 2, priceLineVisible: false }).setData(shown.map((p) => ({ time: p.date, value: p.close })));
      }
      if (avgs) {
        for (const [series, color] of [[avg50, COLORS.avg50], [avg200, COLORS.avg200]] as const) {
          chart.addSeries(LineSeries, { color, lineWidth: 1, crosshairMarkerVisible: false, ...quiet })
            .setData(shown.flatMap((p, i) => (series[offset + i] == null ? [] : [{ time: p.date, value: series[offset + i] as number }])));
        }
      }
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [shown, offset, activeView, avgs, compare, avg50, avg200, isIndex]);

  if (shown.length < 2) return <p className="text-sm text-slate-500">Not enough price history to draw a chart.</p>;

  const change = shown[shown.length - 1].close / shown[0].close - 1;
  const niftyChange = compare && compare.nifty.length > 1 ? compare.nifty[compare.nifty.length - 1].value / 100 - 1 : null;
  const stockChange = compare && compare.stock.length > 1 ? compare.stock[compare.stock.length - 1].value / 100 - 1 : null;

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-700">
          {activeView === "compare" && stockChange != null && niftyChange != null ? (
            <><span className="font-semibold" style={{ color: COLORS.stock }}>{name}</span> {signed(stockChange)}; <span className="font-semibold text-slate-500">Nifty 50</span> {signed(niftyChange)} over {RANGE_WORDS[range]}.</>
          ) : (
            <><span className={`font-semibold ${change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{change >= 0 ? "Up" : "Down"} {Math.abs(change * 100).toFixed(1)}%</span> over {RANGE_WORDS[range]}</>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Chart type" options={canCompare ? VIEWS : VIEWS.filter((v) => v.id !== "compare")} value={activeView} onChange={setView} />
          <Segmented label="Time range" options={RANGES.map((r) => ({ id: r, label: r }))} value={range} onChange={setRange} />
        </div>
      </div>
      <div ref={box} className="mt-4 h-72 md:h-80" role="img" aria-label={`Price chart of ${name} over ${RANGE_WORDS[range]}`} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        {activeView !== "compare" ? (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={avgs} onChange={(e) => setAvgs(e.target.checked)} className="accent-indigo-600" />
            Show the <span style={{ color: COLORS.avg50 }} className="font-semibold">50-day</span> and <span style={{ color: COLORS.avg200 }} className="font-semibold">200-day</span> average price
          </label>
        ) : <span>Both start at 100 on the first day shown, so you can compare the climb.</span>}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="hover:text-slate-700">Charts by TradingView</a>
      </div>
    </div>
  );
}

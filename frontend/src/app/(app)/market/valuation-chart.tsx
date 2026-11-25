"use client";

import { useEffect, useRef } from "react";
import { ColorType, LineSeries, LineStyle, createChart } from "lightweight-charts";

/** A weekly line (e.g. Nifty 50 P/E) with a dashed line at its middle value, so "high or low for it" is visible. */
export function ValuationChart({ points, median, label }: { points: { date: string; value: number }[]; median: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current || points.length < 2) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#64748b", fontFamily: "inherit", attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { priceFormatter: (v: number) => v.toFixed(1) },
      handleScroll: false,
      handleScale: false,
    });
    const line = chart.addSeries(LineSeries, { color: "#4f46e5", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    line.setData(points.map((p) => ({ time: p.date, value: p.value })));
    line.createPriceLine({ price: median, color: "#94a3b8", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "middle" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points, median]);

  return <div ref={box} className="h-56 w-full" role="img" aria-label={label} />;
}

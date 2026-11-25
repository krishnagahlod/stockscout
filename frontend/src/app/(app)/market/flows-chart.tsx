"use client";

import { useEffect, useRef } from "react";
import { ColorType, HistogramSeries, createChart } from "lightweight-charts";

/** Monthly bars above zero (money in) in green and below zero (money out) in red; the label carries the numbers too. */
export function FlowsChart({ points, label }: { points: { date: string; value: number }[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current || points.length < 2) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#64748b", fontFamily: "inherit", attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { priceFormatter: (v: number) => `${Math.round(v / 1000)}k` },
      handleScroll: false,
      handleScale: false,
    });
    const bars = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
    bars.setData(points.map((p) => ({ time: p.date, value: p.value, color: p.value >= 0 ? "#059669" : "#e11d48" })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);

  return <div ref={box} className="h-48 w-full" role="img" aria-label={label} />;
}

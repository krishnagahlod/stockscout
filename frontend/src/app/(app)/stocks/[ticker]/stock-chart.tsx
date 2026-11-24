"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PriceData {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number | null;
}

export function StockChart({ data }: { data: PriceData[] }) {
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("3M");

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeframe === "ALL") return data;

    const daysMap = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
    const days = daysMap[timeframe] || 90;
    // count back from the latest price we have, not today (data can lag)
    const cutoff = new Date(data[data.length - 1].date);
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = data.filter((d) => new Date(d.date) >= cutoff);
    return filtered.length >= 2 ? filtered : data.slice(-Math.min(data.length, days));
  }, [data, timeframe]);

  if (!data || data.length === 0) {
    return (
      <div className="h-[320px] w-full flex items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        No price history available
      </div>
    );
  }

  const chartData = filteredData.map((d) => ({
    rawDate: d.date,
    name: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    price: Number(d.close) || 0,
    volume: Number(d.volume) || 0,
  }));

  const firstPrice = chartData[0]?.price || 1;
  const lastPrice = chartData[chartData.length - 1]?.price || 1;
  const periodReturn = ((lastPrice - firstPrice) / firstPrice) * 100;
  const isPositive = periodReturn >= 0;

  const prices = chartData.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const domainMin = min - min * 0.03;
  const domainMax = max + max * 0.03;

  return (
    <div className="space-y-3">
      {/* Timeframe Bar & Return Stat */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-semibold text-xs px-2.5 py-1 flex items-center gap-1 ${
              isPositive
                ? "border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/30"
            }`}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? "+" : ""}
            {periodReturn.toFixed(2)}% ({timeframe})
          </Badge>
          <span className="text-xs text-slate-400">
            Low: ₹{min.toFixed(0)} · High: ₹{max.toFixed(0)}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                timeframe === tf
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[340px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? "#10b981" : "#6366f1"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? "#10b981" : "#6366f1"}
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgba(120,120,140,0.8)" }}
              dy={8}
              minTickGap={25}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tickFormatter={(v) => `₹${Number(v).toFixed(0)}`}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgba(120,120,140,0.8)" }}
              dx={-8}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#ffffff",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              }}
              formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, "Close Price"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#10b981" : "#6366f1"}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EquityCurvePoint } from "@/lib/api";

interface EquityChartProps {
  data: EquityCurvePoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-slate-100 shadow-xl rounded-xl p-4">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-sm font-bold text-slate-800">
                {entry.name}: <span className="font-mono text-indigo-600">₹{Number(entry.value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function EquityChart({ data }: EquityChartProps) {
  if (data.length === 0) return null;

  // Sample data if too many points (>500)
  const chartData =
    data.length > 500
      ? data.filter((_, i) => i % Math.ceil(data.length / 500) === 0 || i === data.length - 1)
      : data;

  const hasBenchmark = chartData.some((d) => d.benchmark_value !== null);

  const formatINR = (val: number) =>
    `₹${(val / 100000).toFixed(1)}L`;

  return (
    <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
      <CardHeader className="bg-white border-b border-slate-100 px-6 py-5">
        <CardTitle className="text-base font-display">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        <div className="h-[350px] w-full min-h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(d) => d.slice(0, 7)}
                minTickGap={30}
                axisLine={false}
                tickLine={false}
                dy={10}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={formatINR}
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px", fontWeight: 600, color: "#475569" }} />
              <Area
                type="monotone"
                dataKey="portfolio_value"
                stroke="#4f46e5"
                fillOpacity={1}
                fill="url(#colorPortfolio)"
                name="Portfolio"
                strokeWidth={3}
              />
              {hasBenchmark && (
                <Area
                  type="monotone"
                  dataKey="benchmark_value"
                  stroke="#94a3b8"
                  fillOpacity={1}
                  fill="url(#colorBenchmark)"
                  name="Buy & Hold Baseline"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

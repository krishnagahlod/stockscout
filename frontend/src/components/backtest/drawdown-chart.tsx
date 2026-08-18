"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EquityCurvePoint } from "@/lib/api";

interface DrawdownChartProps {
  data: EquityCurvePoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-slate-100 shadow-xl rounded-xl p-4">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <p className="text-sm font-bold text-slate-800">
            Drawdown: <span className="font-mono text-rose-600">{(Number(payload[0].value) * 100).toFixed(2)}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function DrawdownChart({ data }: DrawdownChartProps) {
  if (data.length === 0) return null;

  const chartData =
    data.length > 500
      ? data.filter((_, i) => i % Math.ceil(data.length / 500) === 0 || i === data.length - 1)
      : data;

  return (
    <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
      <CardHeader className="bg-white border-b border-slate-100 px-6 py-5">
        <CardTitle className="text-base font-display">Drawdown</CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        <div className="h-[250px] w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
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
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#f43f5e"
                fillOpacity={1}
                fill="url(#colorDrawdown)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

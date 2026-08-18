"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface PriceData {
  date: string;
  close: number;
}

export function StockChart({ data }: { data: PriceData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
        No price data available
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((d) => ({
    name: new Date(d.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' }),
    price: Number(d.close) || 0,
  }));

  const min = Math.min(...chartData.map(d => d.price));
  const max = Math.max(...chartData.map(d => d.price));
  
  // Add some padding to domain
  const domainMin = min - (min * 0.05);
  const domainMax = max + (max * 0.05);

  return (
    <div className="h-[350px] w-full mt-4 min-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
          <XAxis 
            dataKey="name" 
            tickLine={false} 
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={10}
            minTickGap={20}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[domainMin, domainMax]} 
            tickFormatter={(value) => `₹${value.toFixed(0)}`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            dx={-10}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "var(--card)", 
              borderColor: "var(--border)",
              borderRadius: "8px",
              color: "var(--foreground)"
            }}
            itemStyle={{ color: "var(--primary)", fontWeight: "bold" }}
            formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, "Price"]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={data.length === 1}
            connectNulls={true}
            activeDot={{ r: 6, fill: "var(--primary)", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

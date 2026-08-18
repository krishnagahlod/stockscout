"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface SectorData {
  name: string;
  value: number;
}

interface SectorAllocationChartProps {
  data: SectorData[];
  currentValue: number;
}

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

export function SectorAllocationChart({ data, currentValue }: SectorAllocationChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any) => `₹${Number(value || 0).toFixed(2)}`}
            contentStyle={{ borderRadius: '8px', backgroundColor: 'hsl(var(--card))' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 flex flex-col gap-2">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
              <span className="truncate max-w-[120px]">{entry.name}</span>
            </div>
            <span className="font-medium">{((entry.value / currentValue) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

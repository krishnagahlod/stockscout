"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyReturn } from "@/lib/api";

interface MonthlyHeatmapProps {
  data: MonthlyReturn[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyHeatmap({ data }: MonthlyHeatmapProps) {
  if (data.length === 0) return null;

  // Group by year
  const byYear: Record<number, Record<number, number>> = {};
  for (const d of data) {
    if (!byYear[d.year]) byYear[d.year] = {};
    byYear[d.year][d.month] = d.return_pct;
  }

  const years = Object.keys(byYear).map(Number).sort();

  const getColor = (val: number | undefined): string => {
    if (val === undefined) return "bg-muted";
    const pct = val * 100;
    if (pct >= 5) return "bg-green-600 text-white";
    if (pct >= 2) return "bg-green-500 text-white";
    if (pct >= 0) return "bg-green-300 text-green-900";
    if (pct >= -2) return "bg-red-300 text-red-900";
    if (pct >= -5) return "bg-red-500 text-white";
    return "bg-red-600 text-white";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Monthly Returns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-1 px-2 font-medium">Year</th>
                {MONTHS.map((m) => (
                  <th key={m} className="py-1 px-2 font-medium text-center">
                    {m}
                  </th>
                ))}
                <th className="py-1 px-2 font-medium text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const yearData = byYear[year];
                const yearTotal = Object.values(yearData).reduce(
                  (sum, v) => sum + v,
                  0
                );
                return (
                  <tr key={year}>
                    <td className="py-1 px-2 font-mono font-medium">{year}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const val = yearData[month];
                      return (
                        <td key={month} className="py-1 px-1">
                          <div
                            className={`rounded px-1 py-0.5 text-center font-mono ${getColor(val)}`}
                          >
                            {val !== undefined
                              ? `${(val * 100).toFixed(1)}%`
                              : ""}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-1 px-1">
                      <div
                        className={`rounded px-1 py-0.5 text-center font-mono font-bold ${getColor(yearTotal)}`}
                      >
                        {(yearTotal * 100).toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

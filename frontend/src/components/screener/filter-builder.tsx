"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { MetricInfo, FilterCondition } from "@/lib/api";

export interface FilterRow {
  id: string;
  metric: string;
  op: string;
  value: string;
}

const OPERATORS = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "==", label: "=" },
];

/** Metrics stored as decimals — show percentage hint in UI */
const PERCENTAGE_METRICS = new Set([
  "dividend_yield",
  "roe",
  "roa",
  "roce",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "volatility_30d",
  "volatility_90d",
  "momentum_12m",
  "max_drawdown_1y",
  "revenue_cagr_3y",
  "revenue_cagr_5y",
  "eps_cagr_3y",
]);

interface FilterBuilderProps {
  metrics: MetricInfo[];
  filters: FilterRow[];
  onChange: (filters: FilterRow[]) => void;
}

export function FilterBuilder({ metrics, filters, onChange }: FilterBuilderProps) {
  const addFilter = () => {
    const defaultMetric = metrics[0]?.name ?? "";
    onChange([
      ...filters,
      { id: crypto.randomUUID(), metric: defaultMetric, op: ">", value: "" },
    ]);
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof FilterRow, value: string) => {
    onChange(
      filters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  return (
    <div className="space-y-3">
      {filters.map((filter) => {
        const isPct = PERCENTAGE_METRICS.has(filter.metric);
        return (
          <div key={filter.id} className="flex items-center gap-2">
            <select
              value={filter.metric}
              onChange={(e) => updateFilter(filter.id, "metric", e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {metrics.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={filter.op}
              onChange={(e) => updateFilter(filter.id, "op", e.target.value)}
              className="h-9 w-20 rounded-md border bg-background px-3 text-sm"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <Input
              type="number"
              step="any"
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
              placeholder={isPct ? "e.g. 3 for 3%" : "Value"}
              className="h-9 w-32"
            />

            {isPct && (
              <span className="text-xs font-medium text-primary">%</span>
            )}

            <span className="text-xs text-muted-foreground truncate max-w-40">
              {metrics.find((m) => m.name === filter.metric)?.description}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => removeFilter(filter.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addFilter}>
        <Plus className="mr-2 h-4 w-4" />
        Add Filter
      </Button>
    </div>
  );
}

/** Convert UI filter rows to API FilterCondition list.
 *  Percentage metrics: user enters "3" for 3% → stored as 0.03 */
export function filtersToConditions(
  filters: FilterRow[]
): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const f of filters) {
    if (f.metric && f.value !== "") {
      let numVal = parseFloat(f.value);
      // Auto-convert percentage input to decimal for percentage metrics
      if (PERCENTAGE_METRICS.has(f.metric)) {
        numVal = numVal / 100;
      }
      conditions.push({ metric: f.metric, op: f.op, value: numVal });
    }
  }
  return conditions;
}

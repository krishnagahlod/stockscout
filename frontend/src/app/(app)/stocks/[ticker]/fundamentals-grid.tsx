import { formatNumber } from "@/lib/utils";

export function FundamentalsGrid({ fundamentals }: { fundamentals: any }) {
  if (!fundamentals) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No fundamental data available.
      </div>
    );
  }

  const formatVal = (val: number | null | undefined, isCurrency: boolean = false) => {
    if (val === null || val === undefined) return "N/A";
    return isCurrency ? formatNumber(val) : val.toFixed(2);
  };

  const items = [
    { label: "Market Cap (₹ Cr)", value: formatVal(fundamentals.market_cap, true) },
    { label: "P/E Ratio", value: formatVal(fundamentals.pe) },
    { label: "P/B Ratio", value: formatVal(fundamentals.pb) },
    { label: "ROE (%)", value: formatVal(fundamentals.roe) },
    { label: "ROCE (%)", value: formatVal(fundamentals.roce) },
    { label: "Debt to Equity", value: formatVal(fundamentals.debt_to_equity) },
    { label: "Dividend Yield (%)", value: formatVal(fundamentals.dividend_yield) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col space-y-1 p-3 bg-muted/50 rounded-lg border border-border/50">
          <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
          <span className="text-sm font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

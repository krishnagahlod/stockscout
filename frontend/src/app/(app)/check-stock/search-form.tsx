"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StockAutocomplete } from "@/components/stock-autocomplete";
import { useState } from "react";

export function CheckStockSearchForm({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSymbol) {
      router.push(`/check-stock?q=${selectedSymbol}`);
    }
  };

  return (
    <form className="flex items-center gap-3 w-full" onSubmit={handleSubmit}>
      <StockAutocomplete 
        defaultValue={defaultValue}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          router.push(`/check-stock?q=${symbol}`);
        }}
        placeholder="e.g. RELIANCE, TCS"
      />
      <Button type="submit" disabled={!selectedSymbol}>Analyze</Button>
    </form>
  );
}

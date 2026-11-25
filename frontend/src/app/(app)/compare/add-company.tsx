"use client";

import { useRouter } from "next/navigation";
import { StockAutocomplete } from "@/components/stock-autocomplete";

export function AddCompany({ current }: { current: string[] }) {
  const router = useRouter();
  if (current.length >= 3) return <p className="text-sm text-slate-500">Three is the most we compare at once. Remove one to add another.</p>;
  return (
    <div>
      <label className="mb-1 block text-sm text-slate-600">Add a company or ETF</label>
      <StockAutocomplete placeholder="e.g. ITC or Coal India"
        onSelect={(symbol) => router.push(`/compare?t=${[...current, symbol.replace(/\.(NS|BO)$/i, "")].join(",")}`)} />
    </div>
  );
}

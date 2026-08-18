"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useDebounce } from "use-debounce";
import { getStocks, Stock } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface StockAutocompleteProps {
  onSelect: (symbol: string) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function StockAutocomplete({
  onSelect,
  defaultValue = "",
  placeholder = "e.g. RELIANCE, TCS",
  className = "",
}: StockAutocompleteProps) {
  const [query, setQuery] = React.useState(defaultValue);
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = React.useState<Stock[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    async function searchStocks() {
      if (!debouncedQuery || debouncedQuery.trim() === "") {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await getStocks({ search: debouncedQuery, page_size: 5 });
        setResults(response.items || []);
        if (response.items && response.items.length > 0) {
           setIsOpen(true);
        }
      } catch (err) {
        console.error(err);
        setResults([]);
      }
      setLoading(false);
    }
    
    // Only search if it's different from the initial default (meaning user is actively typing)
    // Or just search anyway to show results if user clicks in.
    if (debouncedQuery !== defaultValue || isOpen) {
       searchStocks();
    }
  }, [debouncedQuery]);

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
             setQuery(e.target.value);
             setIsOpen(true);
          }}
          onFocus={() => {
             if (query.trim() !== "") setIsOpen(true);
          }}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {isOpen && (loading || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-md border shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {loading && (
             <div className="p-4 text-sm text-center text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && (
             <div className="p-4 text-sm text-center text-muted-foreground">No stocks found.</div>
          )}
          {!loading && results.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 border-slate-100"
              onClick={() => {
                setQuery(stock.symbol.replace('.NS', ''));
                setIsOpen(false);
                onSelect(stock.symbol);
              }}
            >
              <div className="flex flex-col flex-1">
                <span className="font-semibold text-slate-900">{stock.symbol.replace('.NS', '')}</span>
                <span className="text-xs text-muted-foreground truncate">{stock.name}</span>
              </div>
              {stock.sector && (
                <Badge variant="outline" className="ml-2 whitespace-nowrap hidden sm:inline-flex">
                  {stock.sector}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

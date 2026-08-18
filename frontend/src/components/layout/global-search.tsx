"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "use-debounce";
import { getStocks, Stock } from "@/lib/api";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = React.useState<Stock[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    async function searchStocks() {
      if (!debouncedQuery) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await getStocks({ search: debouncedQuery, page_size: 5 });
        setResults(response.items || []);
      } catch (err) {
        console.error(err);
        setResults([]);
      }
      setLoading(false);
    }
    searchStocks();
  }, [debouncedQuery]);

  const handleSelect = (symbol: string) => {
    setOpen(false);
    router.push(`/stocks/${symbol}`);
  };

  return (
    <>
      <div 
        className="relative w-full max-w-sm hidden md:flex items-center cursor-text"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search stocks (Press ⌘K)"
          className="w-full bg-background pl-8 pointer-events-none"
          readOnly
        />
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Type a ticker or company name..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && <div className="p-4 text-sm text-center text-muted-foreground">Searching...</div>}
          {!loading && results.length === 0 && <CommandEmpty>No stocks found.</CommandEmpty>}
          <CommandGroup heading="Stocks">
            {results.map((stock) => (
              <CommandItem
                key={stock.id}
                value={`${stock.symbol} ${stock.name}`}
                onSelect={() => handleSelect(stock.symbol)}
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{stock.symbol}</span>
                  <span className="text-xs text-muted-foreground">{stock.name}</span>
                </div>
                {stock.sector && (
                  <Badge variant="outline" className="ml-auto">
                    {stock.sector}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

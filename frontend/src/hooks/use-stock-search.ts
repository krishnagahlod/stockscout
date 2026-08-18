import { useState } from 'react';
import { searchAllStocks, SearchStockResult } from '@/lib/api';
import { useDebouncedCallback } from 'use-debounce';


export function useStockSearch(debounceMs = 300) {
  const [results, setResults] = useState<SearchStockResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useDebouncedCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchAllStocks(query);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to search stocks');
    } finally {
      setIsLoading(false);
    }
  }, debounceMs);

  return { results, isLoading, error, search, setResults };
}

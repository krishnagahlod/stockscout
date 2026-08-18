import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHealth,
  getStocks,
  getStock,
  getStockPrices,
  getSectors,
  getSyncStatus,
  syncUniverse,
  syncPrices,
  getSyncProgress,
  recomputeTechnical,
  recomputeFundamentals,
} from "@/lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30000,
  });
}

export function useStocks(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  sector?: string;
}) {
  return useQuery({
    queryKey: ["stocks", params],
    queryFn: () => getStocks(params),
  });
}

export function useStock(symbol: string) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => getStock(symbol),
    enabled: !!symbol,
  });
}

export function useStockPrices(
  symbol: string,
  params?: { start?: string; end?: string; limit?: number }
) {
  return useQuery({
    queryKey: ["stock-prices", symbol, params],
    queryFn: () => getStockPrices(symbol, params),
    enabled: !!symbol,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: getSectors,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: getSyncStatus,
    refetchInterval: 10000,
  });
}

export function useSyncUniverse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncUniverse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useSyncAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { syncAll } = await import("@/lib/api");
      return syncAll();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useSyncPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: { limit?: number; symbol?: string; start_date?: string }) =>
      syncPrices(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useSyncProgress(enabled: boolean = false) {
  return useQuery({
    queryKey: ["sync-progress"],
    queryFn: getSyncProgress,
    refetchInterval: enabled ? 2000 : false,
    enabled,
  });
}

export function useRecomputeTechnical() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) => recomputeTechnical(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useRecomputeFundamentals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) => recomputeFundamentals(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  runBacktest,
  getBacktestResult,
  getBacktestResults,
  type BacktestRequest,
} from "@/lib/api";

export function useRunBacktest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BacktestRequest) => runBacktest(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-results"] });
    },
  });
}

export function useBacktestResult(id: number | null) {
  return useQuery({
    queryKey: ["backtest-result", id],
    queryFn: () => getBacktestResult(id!),
    enabled: !!id,
  });
}

export function useBacktestResults(strategyId?: number) {
  return useQuery({
    queryKey: ["backtest-results", strategyId],
    queryFn: () => getBacktestResults({ strategy_id: strategyId }),
  });
}

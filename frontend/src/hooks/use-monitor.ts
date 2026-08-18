import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStrategyDriftReport,
  runBatchMonitoring,
  StrategyDriftReport,
} from "@/lib/api";

export function useStrategyDrift(strategyId?: number) {
  return useQuery({
    queryKey: ["strategy-drift", strategyId],
    queryFn: () => (strategyId ? getStrategyDriftReport(strategyId) : null),
    enabled: !!strategyId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useRunBatchMonitoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runBatchMonitoring,
    onSuccess: (reports: StrategyDriftReport[]) => {
      reports.forEach((report) => {
        queryClient.setQueryData(["strategy-drift", report.strategy_id], report);
      });
      queryClient.invalidateQueries({ queryKey: ["strategy-drift"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

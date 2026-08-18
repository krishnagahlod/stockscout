import { useQuery, useMutation } from "@tanstack/react-query";
import { getRebalancePlan, notifyRebalancePlan } from "@/lib/api";

export function useRebalancePlan(strategyId?: number, capital: number = 500000.0) {
  return useQuery({
    queryKey: ["rebalance-plan", strategyId, capital],
    queryFn: () => (strategyId ? getRebalancePlan(strategyId, capital) : null),
    enabled: !!strategyId && capital > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useNotifyRebalance() {
  return useMutation({
    mutationFn: ({ strategyId, capital }: { strategyId: number; capital: number }) =>
      notifyRebalancePlan(strategyId, capital),
  });
}

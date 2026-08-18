import { useQuery, useMutation } from "@tanstack/react-query";
import { runScreener, getMetrics, type StrategyRules } from "@/lib/api";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: getMetrics,
  });
}

export function useRunScreener() {
  return useMutation({
    mutationFn: (rules: StrategyRules) => runScreener(rules),
  });
}

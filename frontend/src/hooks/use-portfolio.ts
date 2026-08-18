import { useQuery, useMutation } from "@tanstack/react-query";
import {
  optimizePortfolio,
  getRegime,
  getPortfolioPlaybook,
  getPortfolioDrift,
  getPortfolioRebalanceSheet,
  notifyPortfolioRebalance,
} from "@/lib/api";

export function useOptimizePortfolio() {
  return useMutation({
    mutationFn: ({
      strategyId,
      method,
      capital,
    }: {
      strategyId: number;
      method: string;
      capital: number;
    }) => optimizePortfolio(strategyId, method, capital),
  });
}

export function useRegime() {
  return useQuery({
    queryKey: ["regime"],
    queryFn: getRegime,
    refetchInterval: 60000,
  });
}

export function usePortfolioPlaybook(userId?: string) {
  return useQuery({
    queryKey: ["portfolio-playbook", userId],
    queryFn: () => (userId ? getPortfolioPlaybook(userId) : null),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortfolioDrift(userId?: string) {
  return useQuery({
    queryKey: ["portfolio-drift", userId],
    queryFn: () => (userId ? getPortfolioDrift(userId) : null),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortfolioRebalanceSheet(
  userId?: string,
  sizingMethod: string = "risk_parity",
  capitalMode: string = "existing",
  additionalCapital: number = 0.0
) {
  return useQuery({
    queryKey: ["portfolio-rebalance-sheet", userId, sizingMethod, capitalMode, additionalCapital],
    queryFn: () =>
      userId
        ? getPortfolioRebalanceSheet({ userId, sizingMethod, capitalMode, additionalCapital })
        : null,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotifyPortfolioRebalance() {
  return useMutation({
    mutationFn: (params: {
      userId: string;
      email?: string;
      telegramChatId?: string;
      capitalMode?: string;
      additionalCapital?: number;
    }) => notifyPortfolioRebalance(params),
  });
}

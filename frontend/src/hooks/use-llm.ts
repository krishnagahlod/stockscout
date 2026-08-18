import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getLLMStatus,
  parseStrategy,
  generateThesis,
  generateThesisFromRules,
  explainStock,
  explainRules,
  quickPreview,
  generatePlaybook,
  getStrategyPlaybook,
  getLiveMacroContext,
} from "@/lib/api";
import type { StrategyRules } from "@/lib/api";

export function useLLMStatus() {
  return useQuery({
    queryKey: ["llm-status"],
    queryFn: getLLMStatus,
    refetchInterval: 30000,
  });
}

export function useLiveMacroContext() {
  return useQuery({
    queryKey: ["live-macro-context"],
    queryFn: getLiveMacroContext,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useParseStrategy() {
  return useMutation({
    mutationFn: (prompt: string) => parseStrategy(prompt),
  });
}

export function useGenerateThesis() {
  return useMutation({
    mutationFn: (strategyId: number) => generateThesis(strategyId),
  });
}

export function useGenerateThesisFromRules() {
  return useMutation({
    mutationFn: (rulesJson: string) => generateThesisFromRules(rulesJson),
  });
}

export function useGeneratePlaybook() {
  return useMutation({
    mutationFn: (payload: { strategy_id?: number; rules?: StrategyRules }) =>
      generatePlaybook(payload),
  });
}

export function useGetStrategyPlaybook(strategyId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ["strategy-playbook", strategyId],
    queryFn: () => getStrategyPlaybook(strategyId),
    enabled: enabled && !!strategyId,
  });
}

export function useExplainStock() {
  return useMutation({
    mutationFn: ({ symbol, strategyId }: { symbol: string; strategyId?: number }) =>
      explainStock(symbol, strategyId),
  });
}

export function useExplainRules() {
  return useMutation({
    mutationFn: (rules: StrategyRules) => explainRules(rules),
  });
}

export function useQuickPreview() {
  return useMutation({
    mutationFn: (rules: StrategyRules) => quickPreview(rules),
  });
}


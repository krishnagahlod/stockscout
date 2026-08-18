import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStrategies,
  getStrategy,
  createStrategy,
  updateStrategy,
  deleteStrategy,
} from "@/lib/api";

export function useStrategies(params?: { page?: number; status?: string }) {
  return useQuery({
    queryKey: ["strategies", params],
    queryFn: () => getStrategies(params),
  });
}

export function useStrategy(id: number) {
  return useQuery({
    queryKey: ["strategy", id],
    queryFn: () => getStrategy(id),
    enabled: id > 0,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string; rules_json?: string; position_sizing?: string; status?: string }) =>
      updateStrategy(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategy", vars.id] });
      // Invalidate related strategy data
      queryClient.invalidateQueries({ queryKey: ["strategy-playbook", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["thesis", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["backtests", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["strategy-rebalance", vars.id] });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

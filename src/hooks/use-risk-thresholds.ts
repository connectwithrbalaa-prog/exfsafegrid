import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RiskThreshold {
  id: string;
  model_name: string;
  band_name: string;
  min_probability: number;
  display_order: number;
  color_hex: string;
  updated_at: string;
}

export function useRiskThresholds(modelName?: string) {
  return useQuery({
    queryKey: ["risk-thresholds", modelName],
    queryFn: async () => {
      let q = supabase
        .from("risk_thresholds" as any)
        .select("*")
        .order("display_order", { ascending: true });
      if (modelName) q = q.eq("model_name", modelName);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as RiskThreshold[]) || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, min_probability }: { id: string; min_probability: number }) => {
      const { error } = await supabase
        .from("risk_thresholds" as any)
        .update({ min_probability, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risk-thresholds"] }),
  });
}

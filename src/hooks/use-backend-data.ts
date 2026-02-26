/**
 * React hooks for consuming the FastAPI backend via backend-proxy.
 * Falls back gracefully when the backend is unreachable.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  backendHealth,
  getPsaRisk,
  getCircuitIgnitionRisk,
  getBriefing,
  generateBriefing,
  getPspsWatchlist,
  generatePspsWatchlist,
  getActiveIncidents,
  getCurrentPerimeters,
  get7DayOutlooks,
  getIngestionStatus,
  trainModels,
  scoreModels,
  triggerIngestion,
  getCircuitRiskTrend,
  getNearbySensors,
  type PsaRiskParams,
  type CircuitIgnitionParams,
  type ActiveIncidentsParams,
  type NearbySensorsParams,
} from "@/lib/backend-api";

const STALE = 5 * 60_000; // 5 min

// Backend reachable?
export const useBackendHealth = () =>
  useQuery({
    queryKey: ["backend-health"],
    queryFn: backendHealth,
    staleTime: 60_000,
    retry: 1,
  });

// Predictions
export const usePsaRisk = (params?: PsaRiskParams) =>
  useQuery({
    queryKey: ["psa-risk", params],
    queryFn: () => getPsaRisk(params),
    staleTime: STALE,
    retry: 1,
  });

export const useCircuitIgnitionRisk = (params?: CircuitIgnitionParams) =>
  useQuery({
    queryKey: ["circuit-ignition-risk", params],
    queryFn: () => getCircuitIgnitionRisk(params),
    staleTime: STALE,
    retry: 1,
  });

// Briefing
export const useBriefing = (date?: string) =>
  useQuery({
    queryKey: ["briefing", date],
    queryFn: () => getBriefing(date).catch((e: Error) => {
      if (e.message.includes("404")) return null;
      throw e;
    }),
    staleTime: STALE,
    retry: (count, error) => !String(error).includes("404") && count < 1,
  });

export const useGenerateBriefing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateBriefing,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing"] }),
  });
};

// PSPS Watchlist
export const usePspsWatchlist = (params?: { watchlist_date?: string; horizon?: string }) =>
  useQuery({
    queryKey: ["psps-watchlist", params],
    queryFn: () => getPspsWatchlist(params).catch((e: Error) => {
      if (e.message.includes("404")) return null;
      throw e;
    }),
    staleTime: STALE,
    retry: (count, error) => !String(error).includes("404") && count < 1,
  });

export const useGenerateWatchlist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generatePspsWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psps-watchlist"] }),
  });
};

// Live Data
export const useActiveIncidents = (params?: ActiveIncidentsParams) =>
  useQuery({
    queryKey: ["active-incidents", params],
    queryFn: () => getActiveIncidents(params),
    staleTime: 2 * 60_000,
    retry: 1,
  });

export const useCurrentPerimeters = (params?: { incident_id?: string }) =>
  useQuery({
    queryKey: ["perimeters", params],
    queryFn: () => getCurrentPerimeters(params),
    staleTime: STALE,
    retry: 1,
  });

export const use7DayOutlooks = (params?: { period_label?: string; psa_id?: string }) =>
  useQuery({
    queryKey: ["outlooks-7day", params],
    queryFn: () => get7DayOutlooks(params),
    staleTime: STALE,
    retry: 1,
  });

// Management
export const useIngestionStatus = () =>
  useQuery({
    queryKey: ["ingestion-status"],
    queryFn: getIngestionStatus,
    staleTime: 30_000,
    retry: 1,
  });

export const useTrainModels = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainModels,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psa-risk", "circuit-ignition-risk"] }),
  });
};

export const useScoreModels = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scoreModels,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psa-risk", "circuit-ignition-risk"] }),
  });
};

export const useTriggerIngestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerIngestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion-status"] }),
  });
};

// Circuit Risk Trend (12h)
export const useCircuitRiskTrend = (circuitId?: string) =>
  useQuery({
    queryKey: ["circuit-risk-trend", circuitId],
    queryFn: () => getCircuitRiskTrend(circuitId!),
    enabled: !!circuitId,
    staleTime: 2 * 60_000,
    retry: (count, error) => !String(error).includes("404") && count < 1,
  });

// Nearby Sensors
export const useNearbySensors = (params?: NearbySensorsParams) =>
  useQuery({
    queryKey: ["nearby-sensors", params],
    queryFn: () => getNearbySensors(params!),
    enabled: !!params?.lat && !!params?.lon,
    staleTime: 3 * 60_000,
    retry: 1,
  });

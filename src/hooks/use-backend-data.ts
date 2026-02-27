// src/hooks/use-backend-data.ts
// React Query hooks for the FastAPI backend (/api/*).
// Vite proxies /api/* → http://localhost:8000 in dev.
// Nginx proxies /api/ → http://api:8000 in production.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// ── Health ────────────────────────────────────────────────────
export function useBackendHealth() {
  return useQuery<{ status: string; service: string; version: string }>({
    queryKey: ["backend-health"],
    queryFn: () => apiFetch("/health"),
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}

// ── Briefing ──────────────────────────────────────────────────
export function useBriefing(briefing_date?: string) {
  const qs = briefing_date ? `?briefing_date=${briefing_date}` : "";
  return useQuery<Record<string, unknown>>({
    queryKey: ["briefing", briefing_date],
    queryFn: () => apiFetch(`/briefing${qs}`),
    retry: false,
  });
}

export function useGenerateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { date?: string; overwrite?: boolean } = {}) =>
      apiFetch("/briefing/generate", {
        method: "POST",
        body: JSON.stringify({ date: opts.date ?? null, overwrite: opts.overwrite ?? false }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing"] }),
  });
}

// ── PSPS Watchlist ────────────────────────────────────────────
export function usePspsWatchlist(params?: {
  horizon?: "24h" | "48h" | "72h";
  watchlist_date?: string;
}) {
  const qs = new URLSearchParams({ horizon: params?.horizon ?? "24h" });
  if (params?.watchlist_date) qs.set("watchlist_date", params.watchlist_date);
  return useQuery<Record<string, unknown>>({
    queryKey: ["psps-watchlist", params],
    queryFn: () => apiFetch(`/psps-watchlist?${qs}`),
    retry: false,
  });
}

export function useGenerateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { horizon?: string; date?: string; overwrite?: boolean } = {}) =>
      apiFetch("/psps-watchlist/generate", {
        method: "POST",
        body: JSON.stringify({
          horizon: opts.horizon ?? "24h",
          date: opts.date ?? null,
          overwrite: opts.overwrite ?? false,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psps-watchlist"] }),
  });
}

// ── Circuit Ignition Risk ─────────────────────────────────────
export function useCircuitIgnitionRisk(params?: {
  horizon_hours?: 24 | 48 | 72;
  psa_id?: string;
  min_prob?: number;
  risk_band?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams({
    horizon_hours: String(params?.horizon_hours ?? 24),
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_prob != null) qs.set("min_prob", String(params.min_prob));
  if (params?.risk_band) qs.set("risk_band", params.risk_band);
  if (params?.limit != null) qs.set("limit", String(params.limit));

  return useQuery<{ count: number; results: unknown[] }>({
    queryKey: ["circuit-ignition-risk", params],
    queryFn: () => apiFetch(`/circuit-ignition-risk?${qs}`),
    staleTime: 30 * 60 * 1000,
  });
}

// ── PSA Risk ──────────────────────────────────────────────────
export function usePsaRisk(params?: {
  psa_id?: string;
  month_offset?: 1 | 2 | 3;
  min_prob?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams({
    month_offset: String(params?.month_offset ?? 1),
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_prob != null) qs.set("min_prob", String(params.min_prob));
  if (params?.limit != null) qs.set("limit", String(params.limit));

  return useQuery<{ count: number; results: unknown[] }>({
    queryKey: ["psa-risk", params],
    queryFn: () => apiFetch(`/psa-risk?${qs}`),
    staleTime: 60 * 60 * 1000,
  });
}

// ── Ingestion Status ──────────────────────────────────────────
export function useIngestionStatus() {
  return useQuery<{
    scheduler_running: boolean;
    sources: { source: string; last_run: string; total_fetched: number; total_inserted: number; error_count: number }[];
  }>({
    queryKey: ["ingestion-status"],
    queryFn: () => apiFetch("/ingestion/status"),
    refetchInterval: 60 * 1000,
  });
}

// ── Active Incidents ──────────────────────────────────────────
export function useActiveIncidents(params?: {
  state?: string;
  psa_id?: string;
  min_acres?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.state) qs.set("state", params.state);
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_acres != null) qs.set("min_acres", String(params.min_acres));
  if (params?.limit != null) qs.set("limit", String(params.limit));

  return useQuery<{ count: number; incidents: unknown[] }>({
    queryKey: ["incidents-active", params],
    queryFn: () => apiFetch(`/incidents/active?${qs}`),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── Train Models ──────────────────────────────────────────────
export function useTrainModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { model?: string; synthetic?: boolean } = {}) =>
      apiFetch("/models/train", {
        method: "POST",
        body: JSON.stringify({ model: opts.model ?? "both", synthetic: opts.synthetic ?? false }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circuit-ignition-risk"] });
      qc.invalidateQueries({ queryKey: ["psa-risk"] });
    },
  });
}

// ── Score Models ──────────────────────────────────────────────
export function useScoreModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { model?: string; prediction_date?: string } = {}) =>
      apiFetch("/models/score", {
        method: "POST",
        body: JSON.stringify({ model: opts.model ?? "both", prediction_date: opts.prediction_date ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circuit-ignition-risk"] });
      qc.invalidateQueries({ queryKey: ["psa-risk"] });
    },
  });
}

// ── Trigger Ingestion ─────────────────────────────────────────
export function useTriggerIngestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: string) =>
      apiFetch(`/ingestion/trigger/${source}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion-status"] }),
  });
}

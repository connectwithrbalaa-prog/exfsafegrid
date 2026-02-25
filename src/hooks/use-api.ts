// src/hooks/use-api.ts
// React Query hooks for the FastAPI backend. Import from here in components.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  PsaRiskResponse,
  IgnitionRiskResponse,
  IncidentsResponse,
  PerimetersResponse,
  OutlooksResponse,
  DailyBriefing,
  PspsWatchlist,
} from "@/lib/api-types";

// ── Active incidents (NIFC WFIGS, refreshes every 5 min) ─────

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

  return useQuery<IncidentsResponse>({
    queryKey: ["incidents", "active", params],
    queryFn: () => apiFetch(`/incidents/active?${qs}`),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── Fire perimeters (NIFC WFIGS, refreshes every 5 min) ──────

export function useCurrentPerimeters(params?: {
  incident_id?: string;
  min_acres?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.incident_id) qs.set("incident_id", params.incident_id);
  if (params?.min_acres != null) qs.set("min_acres", String(params.min_acres));
  if (params?.limit != null) qs.set("limit", String(params.limit));

  return useQuery<PerimetersResponse>({
    queryKey: ["perimeters", "current", params],
    queryFn: () => apiFetch(`/perimeters/current?${qs}`),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── 7-day fire potential outlook (stale after 30 min) ────────

export function use7DayOutlook(params?: {
  period_label?: string;
  psa_id?: string;
  min_potential?: number;
}) {
  const qs = new URLSearchParams({
    period_label: params?.period_label ?? "Day1",
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_potential != null)
    qs.set("min_potential", String(params.min_potential));

  return useQuery<OutlooksResponse>({
    queryKey: ["outlooks", "7day", params],
    queryFn: () => apiFetch(`/outlooks/7day?${qs}`),
    staleTime: 30 * 60 * 1000,
  });
}

// ── Monthly fire outlook (stale after 1 hour) ─────────────────

export function useMonthlyOutlook(params?: {
  period_label?: string;
  min_potential?: number;
}) {
  const qs = new URLSearchParams({
    period_label: params?.period_label ?? "Month1",
  });
  if (params?.min_potential != null)
    qs.set("min_potential", String(params.min_potential));

  return useQuery<OutlooksResponse>({
    queryKey: ["outlooks", "monthly", params],
    queryFn: () => apiFetch(`/outlooks/monthly?${qs}`),
    staleTime: 60 * 60 * 1000,
  });
}

// ── PSA risk model (1–3 month horizon, stale after 1 hour) ───

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

  return useQuery<PsaRiskResponse>({
    queryKey: ["psa-risk", params],
    queryFn: () => apiFetch(`/psa-risk?${qs}`),
    staleTime: 60 * 60 * 1000,
  });
}

// ── Circuit ignition spike model (24/48/72 h) ─────────────────

export function useIgnitionRisk(params?: {
  horizon_hours?: 24 | 48 | 72;
  psa_id?: string;
  circuit_id?: string;
  min_prob?: number;
  risk_band?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  limit?: number;
}) {
  const qs = new URLSearchParams({
    horizon_hours: String(params?.horizon_hours ?? 24),
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.circuit_id) qs.set("circuit_id", params.circuit_id);
  if (params?.min_prob != null) qs.set("min_prob", String(params.min_prob));
  if (params?.risk_band) qs.set("risk_band", params.risk_band);
  if (params?.limit != null) qs.set("limit", String(params.limit));

  return useQuery<IgnitionRiskResponse>({
    queryKey: ["ignition-risk", params],
    queryFn: () => apiFetch(`/circuit-ignition-risk?${qs}`),
    staleTime: 30 * 60 * 1000,
  });
}

// ── Daily ops briefing (Claude agent output) ──────────────────
// Returns 404 if no briefing generated yet for that date.

export function useDailyBriefing(briefing_date?: string) {
  const qs = briefing_date ? `?briefing_date=${briefing_date}` : "";
  return useQuery<DailyBriefing>({
    queryKey: ["briefing", briefing_date ?? "today"],
    queryFn: () => apiFetch(`/briefing${qs}`),
    retry: false, // 404 = not generated yet — don't retry
    staleTime: 10 * 60 * 1000,
  });
}

// ── PSPS watchlist (Claude agent output) ─────────────────────
// Returns 404 if no watchlist generated yet for that date/horizon.

export function usePspsWatchlist(params?: {
  horizon?: "24h" | "48h" | "72h";
  watchlist_date?: string;
}) {
  const qs = new URLSearchParams({ horizon: params?.horizon ?? "24h" });
  if (params?.watchlist_date) qs.set("watchlist_date", params.watchlist_date);

  return useQuery<PspsWatchlist>({
    queryKey: ["psps-watchlist", params],
    queryFn: () => apiFetch(`/psps-watchlist?${qs}`),
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

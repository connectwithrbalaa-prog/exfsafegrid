// src/hooks/use-api.ts
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

// ── Active incidents ─────────────────────────────────────────
export function useActiveIncidents(params?: {
  state?: string;
  psa_id?: string;
  min_acres?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.state) qs.set("state", params.state);
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_acres) qs.set("min_acres", String(params.min_acres));

  return useQuery<IncidentsResponse>({
    queryKey: ["incidents", "active", params],
    queryFn: () => apiFetch(`/incidents/active?${qs}`),
    refetchInterval: 5 * 60 * 1000, // re-fetch every 5 min
  });
}

// ── Fire perimeters ──────────────────────────────────────────
export function useCurrentPerimeters(params?: {
  incident_id?: string;
  min_acres?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.incident_id) qs.set("incident_id", params.incident_id);
  if (params?.min_acres) qs.set("min_acres", String(params.min_acres));

  return useQuery<PerimetersResponse>({
    queryKey: ["perimeters", "current", params],
    queryFn: () => apiFetch(`/perimeters/current?${qs}`),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── 7-day fire outlook ───────────────────────────────────────
export function use7DayOutlook(params?: {
  period_label?: string;
  psa_id?: string;
  min_potential?: number;
}) {
  const qs = new URLSearchParams({ period_label: params?.period_label ?? "Day1" });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_potential) qs.set("min_potential", String(params.min_potential));

  return useQuery<OutlooksResponse>({
    queryKey: ["outlooks", "7day", params],
    queryFn: () => apiFetch(`/outlooks/7day?${qs}`),
    staleTime: 30 * 60 * 1000,
  });
}

// ── Monthly fire outlook ─────────────────────────────────────
export function useMonthlyOutlook(params?: {
  period_label?: string;
  min_potential?: number;
}) {
  const qs = new URLSearchParams({ period_label: params?.period_label ?? "Month1" });
  if (params?.min_potential) qs.set("min_potential", String(params.min_potential));

  return useQuery<OutlooksResponse>({
    queryKey: ["outlooks", "monthly", params],
    queryFn: () => apiFetch(`/outlooks/monthly?${qs}`),
    staleTime: 60 * 60 * 1000,
  });
}

// ── PSA risk (1–3 month model) ───────────────────────────────
export function usePsaRisk(params?: {
  psa_id?: string;
  month_offset?: 1 | 2 | 3;
  min_prob?: number;
}) {
  const qs = new URLSearchParams({
    month_offset: String(params?.month_offset ?? 1),
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_prob) qs.set("min_prob", String(params.min_prob));

  return useQuery<PsaRiskResponse>({
    queryKey: ["psa-risk", params],
    queryFn: () => apiFetch(`/psa-risk?${qs}`),
    staleTime: 60 * 60 * 1000,
  });
}

// ── Circuit ignition risk (24/48/72 h model) ─────────────────
export function useIgnitionRisk(params?: {
  horizon_hours?: 24 | 48 | 72;
  psa_id?: string;
  min_prob?: number;
  risk_band?: string;
}) {
  const qs = new URLSearchParams({
    horizon_hours: String(params?.horizon_hours ?? 24),
  });
  if (params?.psa_id) qs.set("psa_id", params.psa_id);
  if (params?.min_prob) qs.set("min_prob", String(params.min_prob));
  if (params?.risk_band) qs.set("risk_band", params.risk_band);

  return useQuery<IgnitionRiskResponse>({
    queryKey: ["ignition-risk", params],
    queryFn: () => apiFetch(`/circuit-ignition-risk?${qs}`),
    staleTime: 30 * 60 * 1000,
  });
}

// ── Daily ops briefing ───────────────────────────────────────
export function useDailyBriefing(briefing_date?: string) {
  const qs = briefing_date ? `?briefing_date=${briefing_date}` : "";
  return useQuery<DailyBriefing>({
    queryKey: ["briefing", briefing_date],
    queryFn: () => apiFetch(`/briefing${qs}`),
    retry: false, // 404 means not generated yet — don't retry
  });
}

// ── PSPS watchlist ────────────────────────────────────────────
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
  });
}

/**
 * Backend API service layer — proxies requests through the backend-proxy edge function
 * to the external FastAPI backend (exf-wildfire-ops-psps).
 */
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Helper: invoke the backend-proxy edge function
// ---------------------------------------------------------------------------
async function proxyCall<T = any>(
  path: string,
  method: "GET" | "POST" = "GET",
  params?: Record<string, string | number | boolean>,
  body?: unknown
): Promise<T> {
  // Build query params — "path" is reserved for the proxy to know which FastAPI route to hit
  const queryParams: Record<string, string> = { path };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") queryParams[k] = String(v);
    }
  }

  const qs = new URLSearchParams(queryParams).toString();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `https://${projectId}.supabase.co/functions/v1/backend-proxy?${qs}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };

  // Attach session token if available
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Backend ${path} responded ${res.status}: ${errBody}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export const backendHealth = () => proxyCall("/health");

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------
export interface PsaRiskParams {
  psa_id?: string;
  month_offset?: number;
  min_prob?: number;
  prediction_date?: string;
  limit?: number;
}

export const getPsaRisk = (p?: PsaRiskParams) =>
  proxyCall("/psa-risk", "GET", p as any);

export interface CircuitIgnitionParams {
  circuit_id?: string;
  horizon_hours?: number;
  psa_id?: string;
  min_prob?: number;
  risk_band?: string;
  prediction_date?: string;
  limit?: number;
}

export const getCircuitIgnitionRisk = (p?: CircuitIgnitionParams) =>
  proxyCall("/circuit-ignition-risk", "GET", p as any);

export interface FireSpreadParams {
  circuit_id?: string;
  psa_id?: string;
  min_spread?: number;
  severity?: string;
  prediction_date?: string;
  limit?: number;
}

export const getFireSpreadRisk = (p?: FireSpreadParams) =>
  proxyCall("/fire-spread-risk", "GET", p as any);

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
export const getBriefing = (briefing_date?: string) =>
  proxyCall("/briefing", "GET", briefing_date ? { briefing_date } : undefined);

export const generateBriefing = (body?: { date?: string; overwrite?: boolean }) =>
  proxyCall("/briefing/generate", "POST", undefined, body);

export const getPspsWatchlist = (params?: { watchlist_date?: string; horizon?: string }) =>
  proxyCall("/psps-watchlist", "GET", params as any);

export const generatePspsWatchlist = (body?: { date?: string; horizon?: string; overwrite?: boolean }) =>
  proxyCall("/psps-watchlist/generate", "POST", undefined, body);

// ---------------------------------------------------------------------------
// Live Data
// ---------------------------------------------------------------------------
export interface ActiveIncidentsParams {
  state?: string;
  psa_id?: string;
  min_acres?: number;
  limit?: number;
}

export const getActiveIncidents = (p?: ActiveIncidentsParams) =>
  proxyCall("/incidents/active", "GET", p as any);

export const getCurrentPerimeters = (params?: { incident_id?: string; min_acres?: number; limit?: number }) =>
  proxyCall("/perimeters/current", "GET", params as any);

export const get7DayOutlooks = (params?: { forecast_date?: string; period_label?: string; psa_id?: string; min_potential?: number }) =>
  proxyCall("/outlooks/7day", "GET", params as any);

export const getMonthlyOutlooks = (params?: { forecast_date?: string; period_label?: string; min_potential?: number }) =>
  proxyCall("/outlooks/monthly", "GET", params as any);

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------
export const trainModels = (body?: { model?: string; synthetic?: boolean }) =>
  proxyCall("/models/train", "POST", undefined, body);

export const scoreModels = (body?: { prediction_date?: string; model?: string }) =>
  proxyCall("/models/score", "POST", undefined, body);

export const getIngestionStatus = () =>
  proxyCall("/ingestion/status");

export const triggerIngestion = (source: string) =>
  proxyCall(`/ingestion/trigger/${source}`, "POST");

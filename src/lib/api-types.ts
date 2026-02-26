// src/lib/api-types.ts
// TypeScript types for all FastAPI backend responses.

// ── Predictions ───────────────────────────────────────────────

export interface PsaRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_above_normal: number; // 0–1
  risk_bucket: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  drivers: string | null;
  hftd_tier: string | null;
  customer_count: number | null;
  county: string | null;
  voltage_kv: number | null;
}

export interface PsaRiskResponse {
  prediction_date: string; // "YYYY-MM-DD"
  horizon: string;         // "Month1" | "Month2" | "Month3"
  model: "psa_risk";
  count: number;
  results: PsaRiskResult[];
}

export interface IgnitionRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_spike: number; // 0–1
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  drivers: string | null;
  hftd_tier: string | null;
  customer_count: number | null;
  critical_customers: number | null;
  county: string | null;
}

export interface IgnitionRiskResponse {
  prediction_date: string;
  horizon_hours: 24 | 48 | 72;
  model: "ignition_spike";
  count: number;
  results: IgnitionRiskResult[];
}

// ── Live Data ─────────────────────────────────────────────────

export interface Incident {
  incident_id: string;
  incident_name: string;
  state: string;
  psa_id: string | null;
  cause: string | null;
  discovery_date: string | null;
  acres_burned: number | null;
  containment_pct: number | null;
  latitude: number | null;
  longitude: number | null;
  retrieved_at: string;
}

export interface IncidentsResponse {
  count: number;
  incidents: Incident[];
}

export interface Perimeter {
  perimeter_id: string;
  incident_id: string;
  incident_name: string;
  state: string;
  gis_acres: number | null;
  map_acres: number | null;
  containment_pct: number | null;
  date_current: string | null;
  retrieved_at: string;
}

export interface PerimetersResponse {
  count: number;
  perimeters: Perimeter[];
}

export interface Outlook {
  psa_id: string;
  period_label: string;        // "Day1"–"Day7", "Month1"–"Month3"
  forecast_date: string;
  fire_potential: number;      // 1=BelowNormal … 5=ExtremelyCritical
  fire_potential_label: string;
  retrieved_at: string;
}

export interface OutlooksResponse {
  forecast_date: string;
  period_label: string;
  count: number;
  outlooks: Outlook[];
}

// ── Agents ────────────────────────────────────────────────────

export interface DailyBriefing {
  id: string;                // UUID
  briefing_date: string;
  markdown_text: string;     // Markdown from Claude ops briefing agent
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface PspsWatchlist {
  id: string;                // UUID
  watchlist_date: string;
  horizon: "24h" | "48h" | "72h";
  markdown_text: string;     // Markdown from Claude PSPS planning agent
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

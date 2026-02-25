# ExfSafeGrid — Lovable Backend Integration Guide

This document tells you exactly what to build to connect the React/Vite frontend
to the live FastAPI backend. Follow it top-to-bottom.

---

## 1. Architecture

```
Browser
  │
  ├─ /api/*  ──(nginx proxy)──▶  FastAPI  (api:8000)   ← YOU ARE WIRING THIS
  │
  └─ Supabase SDK              ◀  Auth, table queries, streaming chat  (keep as-is)
```

- All FastAPI calls use the **relative path `/api/...`** — no env var needed in production.
  Nginx proxies `/api/` → `http://api:8000/`.
- Supabase handles **auth only**. The Supabase session JWT is **not** used for FastAPI calls.
- FastAPI has an optional `X-API-Key` header. If `API_KEY` is unset on the server the header
  is ignored. For now, omit the header; add it later if the server enforces it.

---

## 2. Create `src/lib/api-client.ts`

Create this file exactly as shown. It is the only place that knows the base path.

```ts
// src/lib/api-client.ts
const BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}
```

---

## 3. TypeScript types for all API responses

Create this file so every hook is fully typed.

```ts
// src/lib/api-types.ts

// ── Predictions ──────────────────────────────────────────────
export interface PsaRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_above_normal: number;   // 0–1
  risk_bucket: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  drivers: string | null;
  hftd_tier: string | null;
  customer_count: number | null;
  county: string | null;
  voltage_kv: number | null;
}

export interface PsaRiskResponse {
  prediction_date: string;     // "YYYY-MM-DD"
  horizon: string;             // "Month1" | "Month2" | "Month3"
  model: "psa_risk";
  count: number;
  results: PsaRiskResult[];
}

export interface IgnitionRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_spike: number;          // 0–1
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

// ── Live Data ────────────────────────────────────────────────
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
  period_label: string;
  forecast_date: string;
  fire_potential: number;       // 1–5
  fire_potential_label: string;
  retrieved_at: string;
}

export interface OutlooksResponse {
  forecast_date: string;
  period_label: string;
  count: number;
  outlooks: Outlook[];
}

// ── Agents ───────────────────────────────────────────────────
export interface DailyBriefing {
  id: number;
  briefing_date: string;
  content: string;              // markdown text from Claude agent
  generated_at: string;
}

export interface PspsWatchlist {
  id: number;
  watchlist_date: string;
  horizon: "24h" | "48h" | "72h";
  content: string;              // markdown text from Claude agent
  generated_at: string;
}
```

---

## 4. Create `src/hooks/use-api.ts`

All React Query hooks in one place. Import from here in components.

```ts
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
    staleTime: 30 * 60 * 1000, // outlooks change infrequently
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
```

---

## 5. Wire components — what calls what

### `WildfireMap.tsx` and `CustomerWildfireMap.tsx`

Replace any hardcoded/mock incident data with:

```ts
import { useActiveIncidents, useCurrentPerimeters } from "@/hooks/use-api";

const { data: incidentsData, isLoading } = useActiveIncidents({ min_acres: 100 });
const { data: perimetersData } = useCurrentPerimeters({ min_acres: 100 });

// incidentsData.incidents — array of { incident_id, incident_name, latitude, longitude, acres_burned, ... }
// perimetersData.perimeters — array of { perimeter_id, incident_id, gis_acres, ... }
// Use latitude/longitude from incidents to place map markers
// Note: perimeters do NOT contain geometry (GeoJSON) — only metadata.
//       Geometry comes from NIFC ArcGIS. If you need polygon outlines,
//       fetch them directly from the NIFC ArcGIS endpoint using incident_id.
```

### `CommandCenter.tsx`

```ts
import { useDailyBriefing, usePspsWatchlist } from "@/hooks/use-api";

const { data: briefing, isError: noBriefing } = useDailyBriefing();
const { data: watchlist } = usePspsWatchlist({ horizon: "24h" });

// briefing.content   — markdown string, render with a markdown component
// watchlist.content  — markdown string
// If noBriefing is true, show a "Generate Briefing" button (see Section 6)
```

### `PredictiveOutagePanel.tsx`

```ts
import { useIgnitionRisk, usePsaRisk } from "@/hooks/use-api";

const { data: ignition } = useIgnitionRisk({ horizon_hours: 24 });
const { data: psaRisk } = usePsaRisk({ month_offset: 1 });

// ignition.results — sorted by prob_spike desc
// psaRisk.results  — sorted by prob_above_normal desc
// risk_bucket / risk_band values: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
```

### `FireHistoryTimeline.tsx` / outlook panels

```ts
import { use7DayOutlook, useMonthlyOutlook } from "@/hooks/use-api";

const { data: outlook7 } = use7DayOutlook({ period_label: "Day1" });
const { data: outlookM } = useMonthlyOutlook({ period_label: "Month1" });

// fire_potential: 1–5 integer
// fire_potential_label: e.g. "Above Normal", "Normal", "Below Normal"
```

---

## 6. Generate actions (POST endpoints)

For buttons that trigger agent runs, use `useMutation`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Inside CommandCenter.tsx
const queryClient = useQueryClient();

const generateBriefing = useMutation({
  mutationFn: () =>
    apiFetch("/briefing/generate", {
      method: "POST",
      body: JSON.stringify({ overwrite: false }),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["briefing"] });
  },
});

const generateWatchlist = useMutation({
  mutationFn: (horizon: "24h" | "48h" | "72h") =>
    apiFetch("/psps-watchlist/generate", {
      method: "POST",
      body: JSON.stringify({ horizon, overwrite: false }),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["psps-watchlist"] });
  },
});

// Usage in JSX:
// <Button onClick={() => generateBriefing.mutate()} disabled={generateBriefing.isPending}>
//   {generateBriefing.isPending ? "Generating…" : "Generate Briefing"}
// </Button>
// Note: these calls run a Claude agent and can take 15–30 seconds.
```

---

## 7. QueryClient — verify staleTime

`src/App.tsx` should already have a `QueryClient`. Verify it has a reasonable `staleTime`
so components don't hammer the API on every re-render:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,   // 30 seconds minimum
      retry: 1,
    },
  },
});
```

---

## 8. Error and loading states — pattern to follow

Use this pattern consistently across all components:

```tsx
const { data, isLoading, isError, error } = useActiveIncidents();

if (isLoading) return <Skeleton className="h-48 w-full" />;
if (isError) return (
  <div className="text-destructive text-sm p-4">
    Failed to load incidents: {error?.message}
  </div>
);
// render data
```

For 404 responses (briefing/watchlist not yet generated), `isError` will be `true`
and `error.status === 404`. Show a generate button instead of an error message:

```tsx
if (isError && error instanceof ApiError && error.status === 404) {
  return <GenerateBriefingButton />;
}
```

---

## 9. What NOT to change

| Area | Leave alone |
|---|---|
| `src/integrations/supabase/` | Supabase client, types |
| `src/hooks/use-auth.tsx` | Auth is Supabase — do not move to FastAPI |
| `src/lib/chat-stream.ts` | Customer chat uses Supabase edge functions |
| `src/lib/agent-chat-stream.ts` | Agent chat uses Supabase edge functions |
| `src/components/ChatPanel.tsx` | No changes needed |
| `src/components/AgentChatPanel.tsx` | No changes needed |

---

## 10. Files to create / modify summary

| Action | File |
|---|---|
| **CREATE** | `src/lib/api-client.ts` |
| **CREATE** | `src/lib/api-types.ts` |
| **CREATE** | `src/hooks/use-api.ts` |
| **MODIFY** | `src/components/WildfireMap.tsx` — use `useActiveIncidents` + `useCurrentPerimeters` |
| **MODIFY** | `src/components/CustomerWildfireMap.tsx` — same as above |
| **MODIFY** | `src/pages/CommandCenter.tsx` — use `useDailyBriefing` + `usePspsWatchlist` + generate mutations |
| **MODIFY** | `src/components/PredictiveOutagePanel.tsx` — use `useIgnitionRisk` + `usePsaRisk` |
| **MODIFY** | `src/components/FireHistoryTimeline.tsx` — use `use7DayOutlook` + `useMonthlyOutlook` |

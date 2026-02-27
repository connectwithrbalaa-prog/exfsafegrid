# ExfSafeGrid — Lovable Implementation Spec
### Risk Command Center, Ops Intelligence, Live Fire Data, System

**Status of this document:** Production-ready. All file paths, field names, hook
signatures, and component conventions are drawn directly from the live codebase.
Do not invent or rename anything — use what is listed here exactly.

---

## 0. What Already Exists (Do Not Recreate)

The following files are **already in the repo and correct**. Import from them;
do not regenerate them.

| File | What it provides |
|---|---|
| `src/lib/api-client.ts` | `apiFetch<T>(path, init?)` + `ApiError` class |
| `src/lib/api-types.ts` | All TypeScript interfaces (see Section 2) |
| `src/hooks/use-api.ts` | All React Query hooks (see Section 3) |
| `src/lib/render-markdown.ts` | `renderMarkdown(md: string): string` → safe HTML |
| `src/App.tsx` | Routes, `QueryClient` (staleTime 30s, retry 2) |

The app uses:

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives in `src/components/ui/`)
- **TanStack React Query v5** (`@tanstack/react-query`)
- **react-leaflet + leaflet** for maps
- **sonner** for toasts (`import { toast } from "sonner"`)
- **lucide-react** for icons
- **react-router-dom v6** for routing

Supabase handles **auth and streaming chat only**. All FastAPI data calls go
through `apiFetch` — never touch Supabase for ML/live-data endpoints.

---

## 1. Nginx Proxy Contract

```
Browser  →  /api/*  →  nginx  →  http://api:8000/*
```

- **Always use relative paths**: `/api/health`, `/api/psa-risk`, etc.
- Never hardcode `localhost:8000` or any hostname.
- No auth header needed unless `API_KEY` is set server-side (not currently enforced).

Health check to verify connectivity:

```
GET /api/health
→ { "status": "ok", "service": "exf-wildfire-ops-psps", "version": "2.0.0" }
```

---

## 2. Exact TypeScript Types (`src/lib/api-types.ts`)

These are the **real field names** from the live backend. Use them exactly.

### ML Predictions

```ts
// GET /api/psa-risk
interface PsaRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_above_normal: number;          // 0–1  ← the probability field for this model
  risk_bucket: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  drivers: string | null;             // comma-separated string, NOT an array
  hftd_tier: string | null;
  customer_count: number | null;
  county: string | null;
  voltage_kv: number | null;
}
interface PsaRiskResponse {
  prediction_date: string;            // "YYYY-MM-DD"
  horizon: string;                    // "Month1" | "Month2" | "Month3"
  model: "psa_risk";
  count: number;
  results: PsaRiskResult[];
}

// GET /api/circuit-ignition-risk
interface IgnitionRiskResult {
  circuit_id: string;
  psa_id: string;
  prob_spike: number;                 // 0–1  ← the probability field for this model
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  drivers: string | null;             // comma-separated string, NOT an array
  hftd_tier: string | null;
  customer_count: number | null;
  critical_customers: number | null;
  county: string | null;
}
interface IgnitionRiskResponse {
  prediction_date: string;
  horizon_hours: 24 | 48 | 72;
  model: "ignition_spike";
  count: number;
  results: IgnitionRiskResult[];
}
```

**Critical field-name notes:**
- PSA probability → `prob_above_normal` (not `prob_month1`, not `prob_spike`)
- Ignition probability → `prob_spike` (not `prob_24h`, not `prob_above_normal`)
- Risk label for PSA → `risk_bucket`; for ignition → `risk_band`
- Risk band enum → `"MEDIUM"` not `"MODERATE"` (both models)
- `drivers` is a nullable **string**, not `string[]`; split on `","` to render chips

### Live Data

```ts
// GET /api/incidents/active → IncidentsResponse
interface Incident {
  incident_id: string;
  incident_name: string;
  state: string;
  psa_id: string | null;
  cause: string | null;
  discovery_date: string | null;
  acres_burned: number | null;
  containment_pct: number | null;
  latitude: number | null;           // use for map markers
  longitude: number | null;          // use for map markers
  retrieved_at: string;
}
interface IncidentsResponse { count: number; incidents: Incident[]; }

// GET /api/perimeters/current → PerimetersResponse
interface Perimeter {
  perimeter_id: string;
  incident_id: string;
  incident_name: string;
  state: string;
  gis_acres: number | null;
  map_acres: number | null;
  containment_pct: number | null;
  date_current: string | null;
  retrieved_at: string;
  // Note: NO lat/lon and NO GeoJSON geometry in this response.
  // Perimeters = metadata only. For polygon outlines fetch NIFC ArcGIS directly.
}
interface PerimetersResponse { count: number; perimeters: Perimeter[]; }

// GET /api/outlooks/7day and /api/outlooks/monthly → OutlooksResponse
interface Outlook {
  psa_id: string;
  period_label: string;              // "Day1"–"Day7" or "Month1"–"Month3"
  forecast_date: string;
  fire_potential: number;            // 1=BelowNormal … 5=ExtremelyCritical
  fire_potential_label: string;      // e.g. "Above Normal"
  retrieved_at: string;
}
interface OutlooksResponse {
  forecast_date: string;
  period_label: string;
  count: number;
  outlooks: Outlook[];
}
```

### Agent Outputs

```ts
// GET /api/briefing → DailyBriefing
interface DailyBriefing {
  id: string;                        // UUID string
  briefing_date: string;             // "YYYY-MM-DD"
  markdown_text: string;             // render this ← NOT "content", NOT "markdown"
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;                // ISO timestamp ← NOT "generated_at"
}

// GET /api/psps-watchlist → PspsWatchlist
interface PspsWatchlist {
  id: string;                        // UUID string
  watchlist_date: string;
  horizon: "24h" | "48h" | "72h";
  markdown_text: string;             // render this ← NOT "content"
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;                // ← NOT "generated_at"
}
```

---

## 3. React Query Hooks (`src/hooks/use-api.ts`)

All hooks already exist. Import them, do not recreate.

```ts
import {
  usePsaRisk,
  useIgnitionRisk,
  useDailyBriefing,
  usePspsWatchlist,
  useActiveIncidents,
  useCurrentPerimeters,
  use7DayOutlook,
  useMonthlyOutlook,
} from "@/hooks/use-api";
```

### Hook signatures

```ts
usePsaRisk(params?: {
  psa_id?: string;
  month_offset?: 1 | 2 | 3;    // default 1
  min_prob?: number;
  limit?: number;
}) → UseQueryResult<PsaRiskResponse>

useIgnitionRisk(params?: {
  horizon_hours?: 24 | 48 | 72; // default 24
  psa_id?: string;
  circuit_id?: string;
  min_prob?: number;
  risk_band?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  limit?: number;
}) → UseQueryResult<IgnitionRiskResponse>

useDailyBriefing(briefing_date?: string)   // 404 if not yet generated; retry: false
usePspsWatchlist(params?: { horizon?: "24h"|"48h"|"72h"; watchlist_date?: string })

useActiveIncidents(params?: { state?: string; psa_id?: string; min_acres?: number; limit?: number })
useCurrentPerimeters(params?: { incident_id?: string; min_acres?: number; limit?: number })
use7DayOutlook(params?: { period_label?: string; psa_id?: string; min_potential?: number })
useMonthlyOutlook(params?: { period_label?: string; min_potential?: number })
```

### Mutation pattern for generate actions

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const qc = useQueryClient();

const generateBriefing = useMutation({
  mutationFn: () =>
    apiFetch("/briefing/generate", {
      method: "POST",
      body: JSON.stringify({ overwrite: false }),
    }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing"] }),
  onError: (e: Error) => toast.error(`Failed: ${e.message}`),
});

const generateWatchlist = useMutation({
  mutationFn: (payload: { horizon: "24h"|"48h"|"72h"; overwrite?: boolean }) =>
    apiFetch("/psps-watchlist/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["psps-watchlist"] }),
  onError: (e: Error) => toast.error(`Failed: ${e.message}`),
});

// Note: Claude agent calls take 15–45 seconds. Keep button disabled while isPending.
```

---

## 4. Pages to Build

Add these routes to `src/App.tsx` (inside `<Routes>`, above the `*` catch-all):

```tsx
<Route path="/risk"       element={<RiskCommandCenter />} />
<Route path="/ops"        element={<OpsIntelligence />} />
<Route path="/live-fire"  element={<LiveFireData />} />
<Route path="/system"     element={<SystemStatus />} />
```

Create corresponding page files in `src/pages/`.

---

## 5. Page: Risk Command Center (`/risk`)

### Layout

```
Left sidebar nav  |  Main area (tabs)
                  |
                  |  [PSA Risk]  [Ignition Spike]
                  |  ─────────────────────────────
                  |  Filters row
                  |  ─────────────────────────────
                  |  RiskTable (70%)  │  RiskMap (30%)
```

### Tab A — PSA Risk

**Default query:** `GET /api/psa-risk?month_offset=1&min_prob=0.5&limit=100`

**Filters:**

| Control | Type | Values | Default |
|---|---|---|---|
| Month Offset | `<Select>` (Radix) | 1, 2, 3 | 1 |
| Min Probability | `<Slider>` (Radix) | 0.0–1.0 step 0.05 | 0.5 |
| Limit | `<Select>` | 50, 100, 200, 500 | 100 |
| Search | `<input>` free text | matches `circuit_id` or `psa_id` | — |
| Risk Filter | `<Select>` | ALL, CRITICAL, HIGH, MEDIUM, LOW | ALL |

**Data field for probability column:** `item.prob_above_normal`

**Risk label field:** `item.risk_bucket`

**Table columns:**

| Column | Source field | Notes |
|---|---|---|
| Circuit ID | `circuit_id` | |
| PSA | `psa_id` | |
| County | `county` | nullable |
| Risk | `risk_bucket` | colored badge (see Section 8) |
| Probability | `prob_above_normal` | formatted as `(0.82)` or `82%` |
| HFTD Tier | `hftd_tier` | nullable |
| Customers | `customer_count` | nullable, formatted with commas |
| Drivers | `drivers` | split on `","`, render as chips |
| | | "Details" button → DetailsDrawer |

### Tab B — Ignition Spike Risk

**Default query:** `GET /api/circuit-ignition-risk?horizon_hours=24&risk_band=CRITICAL&limit=100`

**Filters:**

| Control | Type | Values | Default |
|---|---|---|---|
| Horizon | `<Select>` | 24h, 48h, 72h | 24 |
| Risk Band | `<Select>` | ALL, CRITICAL, HIGH, MEDIUM, LOW | CRITICAL |
| Limit | `<Select>` | 50, 100, 200, 500 | 100 |
| Search | `<input>` | matches `circuit_id` or `psa_id` | — |

**Data field for probability column:** `item.prob_spike`

**Risk label field:** `item.risk_band`

**Additional table column vs PSA tab:**

| Column | Source field |
|---|---|
| Critical Customers | `critical_customers` (nullable) |

### Sorting (both tabs)

Default sort: probability desc, then `customer_count` desc.
Allow click-to-sort on all numeric columns.

### DetailsDrawer

Use `<Sheet>` (Radix / shadcn `vaul` already installed) triggered by "Details" row button.

Show all non-null fields. Group as:

```
Circuit & Location
  circuit_id, psa_id, county, hftd_tier, voltage_kv (PSA tab only)

Risk Assessment
  risk_bucket / risk_band (badge), prob_above_normal / prob_spike (large number)

Exposure
  customer_count, critical_customers (ignition tab only)

Drivers
  drivers split on "," rendered as chip list; show "—" if null

Metadata
  prediction_date (from response root)

Actions
  [Copy JSON]  →  copies raw result object to clipboard
```

---

## 6. Page: Ops Intelligence (`/ops`)

### Tabs: Daily Briefing | PSPS Watchlist

#### Daily Briefing tab

```ts
const { data, isLoading, isError, error, refetch } = useDailyBriefing();
```

**404 handling** (briefing not yet generated for today):

```tsx
import { ApiError } from "@/lib/api-client";

if (isError && error instanceof ApiError && error.status === 404) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground">No briefing generated yet for today.</p>
      <Button onClick={() => generateBriefing.mutate()} disabled={generateBriefing.isPending}>
        {generateBriefing.isPending ? "Generating… (this takes ~30s)" : "Generate Today's Briefing"}
      </Button>
    </div>
  );
}
```

**Render briefing** (when data exists):

```tsx
// Use the built-in render-markdown utility — no external dep needed
import { renderMarkdown } from "@/lib/render-markdown";

<div
  className="prose prose-sm max-w-none dark:prose-invert"
  dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown_text) }}
/>
```

**Header bar** (always visible):

```
[Date: {data?.briefing_date}]  [Model: {data?.model_used}]  [Tokens: {data?.tokens_used}]
[Generate New Briefing]  [↻ Refresh]
```

"Generate New Briefing" calls `generateBriefing.mutate()` with `{ overwrite: true }`.

#### PSPS Watchlist tab

```ts
const [horizon, setHorizon] = useState<"24h"|"48h"|"72h">("24h");
const { data, isLoading, isError, error, refetch } = usePspsWatchlist({ horizon });
```

Horizon selector (24h / 48h / 72h) shown as a segmented control or Select.

Same 404 → generate button pattern as briefing.

**Render** when data exists:

If `data.structured_data?.watchlist` is a non-empty array, render it as a table:

| Rank | Circuit | Risk | Prob | Customers | Critical | Action | Rationale |
|---|---|---|---|---|---|---|---|

Fields come from `structured_data.watchlist[]` entries. Column names match
what's documented in `docs/api_reference.md` Section "PSPS Watchlist".

If `structured_data` is null or watchlist array is empty, fall back to:

```tsx
<div dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown_text) }} />
```

---

## 7. Page: Live Fire Data (`/live-fire`)

Four sub-tabs. Each follows the same pattern:

```
[Refresh]  [Download JSON]
─────────────────────────
<table> or fallback JSON viewer
```

### Active Incidents tab

```ts
const { data, isLoading, isError, refetch } = useActiveIncidents({ limit: 100 });
// data.incidents[]
```

**Filters row:** State dropdown (free-type or known states), Min Acres input.

**Table columns:** `incident_name`, `state`, `psa_id`, `acres_burned`, `containment_pct`%,
`cause`, `discovery_date`, `retrieved_at`.

**Map overlay** (conditional): if any incident has non-null `latitude` + `longitude`,
show a Leaflet map beneath the table using `react-leaflet`:

```tsx
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

// Place a CircleMarker at (latitude, longitude) for each incident.
// radius proportional to sqrt(acres_burned ?? 1), capped at 30.
// Popup shows incident_name, acres_burned, containment_pct.
```

### Current Perimeters tab

```ts
const { data, isLoading, isError, refetch } = useCurrentPerimeters({ limit: 100 });
// data.perimeters[]
```

**Table columns:** `incident_name`, `state`, `gis_acres`, `map_acres`,
`containment_pct`%, `date_current`, `retrieved_at`.

No map (perimeters have no lat/lon in the response — metadata only).

### 7-Day Outlook tab

```ts
const [periodLabel, setPeriodLabel] = useState("Day1");
const { data, isLoading, isError, refetch } = use7DayOutlook({ period_label: periodLabel });
// data.outlooks[]
```

Period selector: Day1 through Day7 (segmented control).

**Table columns:** `psa_id`, `period_label`, `fire_potential` (1–5 badge),
`fire_potential_label`, `forecast_date`.

Fire potential badge colors:

| Value | Label | Color |
|---|---|---|
| 1 | Below Normal | green |
| 2 | Normal | blue |
| 3 | Above Normal | yellow |
| 4 | Critical | orange |
| 5 | Extremely Critical | red |

### Monthly Outlook tab

```ts
const [periodLabel, setPeriodLabel] = useState("Month1");
const { data, isLoading, isError, refetch } = useMonthlyOutlook({ period_label: periodLabel });
```

Period selector: Month1 through Month3.
Same table columns as 7-Day tab.

### Download JSON button (all tabs)

```tsx
const download = (filename: string, obj: unknown) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Usage:
<Button variant="outline" size="sm" onClick={() => download("incidents.json", data)}>
  Download JSON
</Button>
```

---

## 8. Page: System Status (`/system`)

### Health widget

```tsx
import { apiFetch } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

interface HealthResponse { status: string; service: string; version: string; }

const { data, isLoading, isError } = useQuery<HealthResponse>({
  queryKey: ["health"],
  queryFn: () => apiFetch("/health"),
  refetchInterval: 60_000,
});
```

Display:

```
● ExfSafeGrid Backend                                 [Refresh]
  Status:   ok
  Service:  exf-wildfire-ops-psps
  Version:  2.0.0
  Last checked: {new Date().toLocaleTimeString()}
```

Green dot when `status === "ok"`, red dot otherwise.

### Ingestion status

```ts
const { data } = useQuery({
  queryKey: ["ingestion-status"],
  queryFn: () => apiFetch("/ingestion/status"),
  staleTime: 5 * 60 * 1000,
});
```

Render as a table. Fields are untyped — show key/value pairs or a JSON viewer.
Add a "Download JSON" button (same pattern as Section 7).

### Query cache stats (debug panel)

```tsx
import { useQueryClient } from "@tanstack/react-query";
const qc = useQueryClient();
// qc.getQueryCache().getAll() — list of active queries, their status and dataUpdatedAt
```

Render as a collapsible debug panel. Useful for ops to see what's stale.

---

## 9. Shared UI Conventions

### Loading state

```tsx
import { Skeleton } from "@/components/ui/skeleton";

if (isLoading) return (
  <div className="space-y-2 p-4">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-3/4" />
  </div>
);
```

### Error state

```tsx
import { ApiError } from "@/lib/api-client";
import { AlertCircle } from "lucide-react";

if (isError) return (
  <div className="flex items-center gap-2 p-4 text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{error instanceof Error ? error.message : "Unknown error"}</span>
    <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">Retry</Button>
  </div>
);
```

### Risk badge colors

```tsx
const RISK_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH:     "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW:      "bg-green-100 text-green-800 border-green-200",
};

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${RISK_COLORS[level] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      {level}
    </span>
  );
}
```

### Drivers chip list

```tsx
function DriverChips({ drivers }: { drivers: string | null }) {
  if (!drivers) return <span className="text-muted-foreground text-xs">—</span>;
  const items = drivers.split(",").map(d => d.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(d => (
        <span key={d} className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{d}</span>
      ))}
    </div>
  );
}
```

### Toast (use sonner, already configured in App.tsx)

```tsx
import { toast } from "sonner";

toast.success("Briefing generated");
toast.error("Failed to load data");
toast.loading("Generating…", { id: "gen" });
toast.dismiss("gen");
```

### Left sidebar navigation

Use the existing `NavLink` component (`src/components/NavLink.tsx`).
Add entries for the four new pages.

---

## 10. Debounce Pattern (for sliders and search inputs)

```tsx
import { useState, useEffect } from "react";

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Usage in RiskCommandCenter:
const [minProb, setMinProb] = useState(0.5);
const debouncedMinProb = useDebounced(minProb, 400);

// Pass debouncedMinProb to the hook, raw minProb to the slider display.
const { data } = usePsaRisk({ min_prob: debouncedMinProb, month_offset, limit });
```

---

## 11. Cache TTLs (already set in `use-api.ts`)

| Hook | staleTime | refetchInterval |
|---|---|---|
| `usePsaRisk` | 60 min | — |
| `useIgnitionRisk` | 30 min | — |
| `useDailyBriefing` | 10 min | — |
| `usePspsWatchlist` | 10 min | — |
| `useActiveIncidents` | — | 5 min |
| `useCurrentPerimeters` | — | 5 min |
| `use7DayOutlook` | 30 min | — |
| `useMonthlyOutlook` | 60 min | — |

Do not add a manual 60-second cache layer — React Query already handles this.
Add a manual "↻ Refresh" button that calls `refetch()` on each page.

---

## 12. What NOT to Change

| Area | Why |
|---|---|
| `src/integrations/supabase/` | Auth; leave completely alone |
| `src/lib/chat-stream.ts` | Customer chat via Supabase edge functions |
| `src/lib/agent-chat-stream.ts` | Agent chat via Supabase edge functions |
| `src/components/ChatPanel.tsx` | No changes needed |
| `src/components/AgentChatPanel.tsx` | No changes needed |
| `src/lib/api-client.ts` | Already correct; do not regenerate |
| `src/lib/api-types.ts` | Already correct; do not regenerate |
| `src/hooks/use-api.ts` | Already correct; do not regenerate |
| `src/lib/render-markdown.ts` | Already correct |

---

## 13. Files to Create

| File | Description |
|---|---|
| `src/pages/RiskCommandCenter.tsx` | PSA Risk + Ignition Spike tabs |
| `src/pages/OpsIntelligence.tsx` | Briefing + PSPS Watchlist tabs |
| `src/pages/LiveFireData.tsx` | Incidents, Perimeters, Outlooks tabs |
| `src/pages/SystemStatus.tsx` | Health, ingestion status, cache debug |
| `src/components/RiskTable.tsx` | Sortable/filterable risk table (shared) |
| `src/components/RiskMap.tsx` | Leaflet map, conditional on lat/lon |
| `src/components/DetailsDrawer.tsx` | Sheet drawer for row details |
| `src/components/RiskBadge.tsx` | Badge for CRITICAL/HIGH/MEDIUM/LOW |
| `src/components/DriverChips.tsx` | Chips from comma-separated drivers string |
| `src/components/OutlookBadge.tsx` | Badge for fire_potential 1–5 |
| `src/components/JsonViewer.tsx` | Fallback JSON display + Download button |

Modify `src/App.tsx` only to add the four new `<Route>` entries.

---

## 14. Acceptance Checklist

- [ ] `GET /api/health` returns 200 and is displayed on `/system`
- [ ] `/risk` PSA tab loads with default filters (`month_offset=1`, `min_prob=0.5`, `limit=100`)
- [ ] `/risk` Ignition tab loads with default filters (`horizon_hours=24`, `risk_band=CRITICAL`, `limit=100`)
- [ ] Changing month offset updates `horizon` label in table header and refetches
- [ ] `min_prob` slider debounces before refetching (no request on every px of drag)
- [ ] `risk_band`/`risk_bucket` filter is applied client-side after fetch (no separate fetch)
- [ ] Search filters table immediately without refetching
- [ ] Drivers column renders chips (not raw comma string)
- [ ] DetailsDrawer opens with all non-null fields; "Copy JSON" works
- [ ] `/ops` briefing renders markdown; 404 shows generate button
- [ ] Generate briefing button disables for duration of POST (~30s), refetches on success
- [ ] PSPS watchlist renders structured table when `structured_data.watchlist` present
- [ ] `/live-fire` incidents map renders when lat/lon present; shows empty state otherwise
- [ ] Download JSON button works on all live data tabs
- [ ] `/system` health dot is green when `status === "ok"`
- [ ] All error states show inline error + Retry button (not a full crash)
- [ ] No `localhost:8000` or hardcoded hosts anywhere in the new code

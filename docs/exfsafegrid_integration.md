# ExfSafeGrid ↔ Backend Integration Guide

This document explains how to wire the **ExfSafeGrid Lovable app** to the
`exf-wildfire-ops-psps` backend service.

---

## 1. Environment Setup (Lovable)

In your Lovable project settings, add these environment variables:

```
VITE_API_BASE_URL=https://your-backend-host:8000
VITE_API_KEY=your-secret-key
```

All API calls should include:

```
X-API-Key: {{VITE_API_KEY}}
Content-Type: application/json
```

---

## 2. Agent View — Daily Ops Briefing

**Component**: `OpsView` → `DailyBriefingPanel`

```typescript
// Fetch latest briefing
const fetchBriefing = async () => {
  const res = await fetch(`${API_BASE}/briefing`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await res.json();
  return data.markdown_text;  // render as Markdown
};

// Generate new briefing (button: "Refresh Briefing")
const generateBriefing = async () => {
  const res = await fetch(`${API_BASE}/briefing/generate`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwrite: true })
  });
  return await res.json();
};
```

**Render**: Use a Markdown renderer (e.g., `react-markdown`) to display `markdown_text`.
**Refresh**: Schedule `fetchBriefing()` on app load + show "Refresh" button.

---

## 3. Customer View — Fire Risk Map

**Component**: `CustomerView` → `RiskMap`

### Fetch Active Incidents (map pins)

```typescript
const getIncidents = async () => {
  const res = await fetch(`${API_BASE}/incidents/active?limit=100`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await res.json();
  return data.incidents;  // [{incident_name, lat, lng, acres_burned, ...}]
};
```

### Fetch Current Perimeters (polygons)

```typescript
const getPerimeters = async () => {
  const res = await fetch(`${API_BASE}/perimeters/current?min_acres=100`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await res.json();
  return data.perimeters;  // render geometry on map
};
```

### Fetch 7-Day Outlook Heatmap

```typescript
const getOutlook = async (day: number = 1) => {
  const res = await fetch(
    `${API_BASE}/outlooks/7day?period_label=Day${day}&min_potential=1`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const data = await res.json();
  // Color PSA polygons by fire_potential (1-5)
  return data.outlooks;
};
```

**Color Scale** for fire_potential:

```typescript
const POTENTIAL_COLORS = {
  1: '#4ade80',  // Below Normal — green
  2: '#facc15',  // Normal — yellow
  3: '#f97316',  // Above Normal — orange
  4: '#ef4444',  // Critical — red
  5: '#7c3aed',  // Extremely Critical — purple
};
```

---

## 4. Agent View — Circuit Risk Dashboard

**Component**: `OpsView` → `CircuitRiskTable`

```typescript
// Top HIGH/CRITICAL circuits for 24h horizon
const getHighRiskCircuits = async () => {
  const res = await fetch(
    `${API_BASE}/circuit-ignition-risk?horizon_hours=24&risk_band=HIGH&limit=50`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const data = await res.json();
  return data.results;
};
// Columns: circuit_id | psa_id | prob_spike | risk_band | hftd_tier | customer_count | county
// Sort by prob_spike DESC
// Color-code risk_band: CRITICAL=red, HIGH=orange, MODERATE=yellow
```

---

## 5. PSPS Watchlist Panel

**Component**: `OpsView` → `PSPSWatchlist`

```typescript
// Get latest watchlist
const getWatchlist = async (horizon = '24h') => {
  const res = await fetch(
    `${API_BASE}/psps-watchlist?horizon=${horizon}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const data = await res.json();
  // data.markdown_text — display in Markdown panel
  // data.structured_data.watchlist — for table/cards
  return data;
};

// Generate new watchlist
const generateWatchlist = async (horizon = '24h') => {
  const res = await fetch(`${API_BASE}/psps-watchlist/generate`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizon, overwrite: true })
  });
  return await res.json();
};
```

**Recommended Action color codes**:

```typescript
const ACTION_COLORS = {
  MONITOR: 'blue',
  ALERT: 'yellow',
  STAGE: 'orange',
  'DE-ENERGIZE': 'red',
};
```

---

## 6. Auto-Refresh Strategy

| Data | Recommended Refresh |
|---|---|
| Active incidents | Every 15 min |
| Perimeters | Every 15 min |
| 7-Day outlooks | Every 3 hours |
| Ignition risk predictions | Every 6 hours |
| Ops briefing | Daily (or on-demand) |
| PSPS watchlist | Daily + on-demand |

```typescript
// Polling helper
const usePolling = (fn: () => Promise<void>, intervalMs: number) => {
  useEffect(() => {
    fn();
    const id = setInterval(fn, intervalMs);
    return () => clearInterval(id);
  }, []);
};

// Usage
usePolling(fetchIncidents, 15 * 60 * 1000);     // 15 min
usePolling(fetchOutlooks, 3 * 60 * 60 * 1000);  // 3 hours
```

---

## 7. Error Handling

```typescript
const apiCall = async (url: string, options = {}) => {
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': API_KEY, ...options.headers },
      ...options,
    });
    if (res.status === 404) return null;         // No data yet
    if (res.status === 403) throw new Error('Auth failed — check API_KEY');
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API call failed:', url, err);
    return null;
  }
};
```

---

## 8. Recommended UI Components by View

### Ops View

| Component | API Call | Update |
|---|---|---|
| Briefing panel | `GET /briefing` | Daily |
| Risk circuit table | `GET /circuit-ignition-risk?risk_band=HIGH` | 6h |
| PSPS watchlist | `GET /psps-watchlist` | Daily |
| Active incidents list | `GET /incidents/active` | 15min |
| Ingestion status badge | `GET /ingestion/status` | 30min |

### Customer View

| Component | API Call | Update |
|---|---|---|
| Wildfire map pins | `GET /incidents/active` | 15min |
| Perimeter polygons | `GET /perimeters/current` | 15min |
| PSA outlook heatmap | `GET /outlooks/7day` | 3h |
| Risk level by ZIP/county | `GET /circuit-ignition-risk` | 6h |

---

## 9. Bootstrap Checklist

Before ExfSafeGrid can display meaningful data:

- [ ] Backend deployed + reachable at VITE_API_BASE_URL
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] Database seeded with `docs/schema.sql`
- [ ] At least one ingestion run completed (`POST /ingestion/trigger/incidents`)
- [ ] Utility circuit data loaded into `utility_circuits` table
- [ ] Model training run (`POST /models/train` with `"synthetic": true` for Phase 1)
- [ ] Scoring run (`POST /models/score`)
- [ ] Briefing generated (`POST /briefing/generate`)

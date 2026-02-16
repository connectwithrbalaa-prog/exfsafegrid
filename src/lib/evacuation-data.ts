/* ── Evacuation Routes, Bottlenecks & Zone ETEs ──────────────
 *
 * Modeled after WFDSS Evacuation Time Estimate (ETE) methodology.
 * Routes mapped to the Madera/Sierra foothill region around monitored assets.
 * ──────────────────────────────────────────────────────────── */

export interface EvacRoute {
  id: string;
  name: string;
  type: "primary" | "secondary" | "alternate";
  coordinates: [number, number][]; // [lng, lat]
  capacityVehiclesHr: number;
  lengthMi: number;
  zones: string[]; // zones this route serves
}

export interface Bottleneck {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: "bridge" | "intersection" | "narrow" | "grade";
  severity: "critical" | "moderate" | "minor";
  description: string;
  delayMinutes: number;
}

export interface ZoneETE {
  zone: string;
  population: number;
  vehicles: number;
  normalEteMin: number;   // ETE under normal conditions
  stressedEteMin: number; // ETE under fire/PSPS stress
  primaryRoute: string;
  alternateRoute: string;
  status: "Clear" | "Congested" | "Blocked";
}

/* ── Route Data ──────────────────────────────────────────────── */

export const EVAC_ROUTES: EvacRoute[] = [
  {
    id: "ER-01",
    name: "SR-41 South Corridor",
    type: "primary",
    coordinates: [
      [-119.28, 37.30], [-119.29, 37.27], [-119.30, 37.24],
      [-119.31, 37.21], [-119.33, 37.18], [-119.35, 37.15],
    ],
    capacityVehiclesHr: 2400,
    lengthMi: 12.4,
    zones: ["Zone A — North Highlands", "Zone B — Valley Central"],
  },
  {
    id: "ER-02",
    name: "Road 200 West Connector",
    type: "primary",
    coordinates: [
      [-119.22, 37.30], [-119.26, 37.28], [-119.30, 37.26],
      [-119.34, 37.24], [-119.38, 37.22],
    ],
    capacityVehiclesHr: 1800,
    lengthMi: 10.8,
    zones: ["Zone D — Foothill East", "Zone A — North Highlands"],
  },
  {
    id: "ER-03",
    name: "SR-49 Ridge Route",
    type: "secondary",
    coordinates: [
      [-119.40, 37.12], [-119.38, 37.15], [-119.36, 37.18],
      [-119.34, 37.20], [-119.32, 37.22],
    ],
    capacityVehiclesHr: 1200,
    lengthMi: 8.6,
    zones: ["Zone C — South Ridge"],
  },
  {
    id: "ER-04",
    name: "Bass Lake Road Alternate",
    type: "alternate",
    coordinates: [
      [-119.23, 37.32], [-119.25, 37.30], [-119.27, 37.28],
      [-119.29, 37.25], [-119.31, 37.22],
    ],
    capacityVehiclesHr: 800,
    lengthMi: 7.2,
    zones: ["Zone D — Foothill East"],
  },
  {
    id: "ER-05",
    name: "Valley Floor Bypass",
    type: "secondary",
    coordinates: [
      [-119.35, 37.18], [-119.37, 37.16], [-119.39, 37.14],
      [-119.41, 37.12], [-119.43, 37.10],
    ],
    capacityVehiclesHr: 1400,
    lengthMi: 6.8,
    zones: ["Zone B — Valley Central", "Zone C — South Ridge"],
  },
];

/* ── Bottleneck Points ───────────────────────────────────────── */

export const BOTTLENECKS: Bottleneck[] = [
  {
    id: "BN-01",
    name: "SR-41 / Road 200 Junction",
    latitude: 37.27,
    longitude: -119.29,
    type: "intersection",
    severity: "critical",
    description: "Single-signal intersection. Merges 2 primary evacuation corridors. No bypass available.",
    delayMinutes: 25,
  },
  {
    id: "BN-02",
    name: "Crane Valley Bridge",
    latitude: 37.30,
    longitude: -119.25,
    type: "bridge",
    severity: "critical",
    description: "Single-lane bridge over Bass Lake inlet. Load limit 15 tons. No heavy vehicle passage during evacuation.",
    delayMinutes: 35,
  },
  {
    id: "BN-03",
    name: "South Ridge Narrows",
    latitude: 37.15,
    longitude: -119.38,
    type: "narrow",
    severity: "moderate",
    description: "Road narrows to single lane for 0.4 mi through rock cut. Alternating traffic flow required.",
    delayMinutes: 15,
  },
  {
    id: "BN-04",
    name: "Foothill Grade — 12% Slope",
    latitude: 37.28,
    longitude: -119.24,
    type: "grade",
    severity: "moderate",
    description: "Steep grade reduces heavy vehicle speed. Chain requirement in winter. Limited pullout areas.",
    delayMinutes: 10,
  },
  {
    id: "BN-05",
    name: "Valley Floor Rail Crossing",
    latitude: 37.16,
    longitude: -119.37,
    type: "intersection",
    severity: "minor",
    description: "Uncontrolled rail crossing. Potential 5–8 min delays if freight train passes during evacuation.",
    delayMinutes: 8,
  },
];

/* ── Zone ETEs ───────────────────────────────────────────────── */

export const ZONE_ETES: ZoneETE[] = [
  {
    zone: "Zone A — North Highlands",
    population: 12000,
    vehicles: 5200,
    normalEteMin: 45,
    stressedEteMin: 85,
    primaryRoute: "SR-41 South Corridor",
    alternateRoute: "Road 200 West Connector",
    status: "Clear",
  },
  {
    zone: "Zone B — Valley Central",
    population: 8500,
    vehicles: 3700,
    normalEteMin: 35,
    stressedEteMin: 65,
    primaryRoute: "SR-41 South Corridor",
    alternateRoute: "Valley Floor Bypass",
    status: "Clear",
  },
  {
    zone: "Zone C — South Ridge",
    population: 9200,
    vehicles: 4100,
    normalEteMin: 55,
    stressedEteMin: 110,
    primaryRoute: "SR-49 Ridge Route",
    alternateRoute: "Valley Floor Bypass",
    status: "Congested",
  },
  {
    zone: "Zone D — Foothill East",
    population: 4800,
    vehicles: 2100,
    normalEteMin: 40,
    stressedEteMin: 75,
    primaryRoute: "Road 200 West Connector",
    alternateRoute: "Bass Lake Road Alternate",
    status: "Clear",
  },
];

/* ── Styling helpers ─────────────────────────────────────────── */

export const ROUTE_STYLES: Record<EvacRoute["type"], { color: string; width: number; dash?: number[] }> = {
  primary:   { color: "#10B981", width: 3.5 },
  secondary: { color: "#3B82F6", width: 2.5, dash: [6, 3] },
  alternate: { color: "#A78BFA", width: 2, dash: [4, 4] },
};

export const BOTTLENECK_STYLES: Record<Bottleneck["severity"], { color: string; size: number }> = {
  critical: { color: "#EF4444", size: 16 },
  moderate: { color: "#F59E0B", size: 13 },
  minor:    { color: "#6B7280", size: 11 },
};

export const BOTTLENECK_ICONS: Record<Bottleneck["type"], string> = {
  bridge: "🌉",
  intersection: "🚦",
  narrow: "⚠️",
  grade: "⛰️",
};

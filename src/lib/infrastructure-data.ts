/* ── Infrastructure segment types & data ─────────────────── */

export interface InfraSegment {
  id: string;
  type: "undergrounded" | "hardened_pole" | "veg_completed" | "veg_planned";
  label: string;
  coords: [number, number][] | [number, number];
}

export const LAYER_META: Record<InfraSegment["type"], { color: string; label: string; dash?: number[] }> = {
  undergrounded: { color: "#22C55E", label: "Undergrounded" },
  hardened_pole: { color: "#3B82F6", label: "Hardened Poles" },
  veg_completed: { color: "#A3E635", label: "Veg Mgmt – Done", dash: [2, 2] },
  veg_planned:   { color: "#FACC15", label: "Veg Mgmt – Planned", dash: [4, 4] },
};

const INFRA_BY_SS: Record<string, InfraSegment[]> = {
  "SS-201": [
    { id: "ug-1", type: "undergrounded", label: "Page Mill Rd Underground (2.1 mi)", coords: [[-122.16, 37.42], [-122.13, 37.43]] },
    { id: "hp-1", type: "hardened_pole", label: "Pole #A-4412 – Strengthened", coords: [-122.145, 37.435] },
    { id: "hp-2", type: "hardened_pole", label: "Pole #A-4419 – Strengthened", coords: [-122.138, 37.438] },
    { id: "vc-1", type: "veg_completed", label: "Arastradero Veg Clear (0.8 mi)", coords: [[-122.17, 37.39], [-122.155, 37.395]] },
    { id: "vp-1", type: "veg_planned", label: "Foothill Expwy Veg (Q3 2026)", coords: [[-122.12, 37.44], [-122.10, 37.45]] },
  ],
  "SS-202": [
    { id: "ug-2", type: "undergrounded", label: "Stevens Creek Underground (1.4 mi)", coords: [[-121.91, 37.32], [-121.89, 37.34]] },
    { id: "hp-3", type: "hardened_pole", label: "Pole #B-2205 – Strengthened", coords: [-121.90, 37.33] },
    { id: "vc-2", type: "veg_completed", label: "Saratoga Hills Veg Clear (1.1 mi)", coords: [[-121.93, 37.30], [-121.91, 37.31]] },
    { id: "vp-2", type: "veg_planned", label: "Prospect Rd Veg (Q4 2026)", coords: [[-121.88, 37.35], [-121.87, 37.36]] },
  ],
  "SS-101": [
    { id: "ug-3", type: "undergrounded", label: "Sierra Vista Underground (1.8 mi)", coords: [[-119.30, 37.24], [-119.27, 37.26]] },
    { id: "hp-4", type: "hardened_pole", label: "Pole #N-1102 – Strengthened", coords: [-119.28, 37.25] },
    { id: "vc-3", type: "veg_completed", label: "Bass Lake Veg Clear (2.3 mi)", coords: [[-119.32, 37.22], [-119.29, 37.23]] },
    { id: "vp-3", type: "veg_planned", label: "Road 200 Veg (Q2 2026)", coords: [[-119.25, 37.27], [-119.23, 37.28]] },
  ],
  "SS-103": [
    { id: "ug-4", type: "undergrounded", label: "South Ridge Blvd Underground (1.5 mi)", coords: [[-119.04, 35.36], [-119.01, 35.38]] },
    { id: "hp-5", type: "hardened_pole", label: "Pole #S-3301 – Strengthened", coords: [-119.02, 35.37] },
    { id: "hp-6", type: "hardened_pole", label: "Pole #S-3318 – Strengthened", coords: [-119.00, 35.38] },
    { id: "vc-4", type: "veg_completed", label: "Kern River Rd Veg Clear (1.9 mi)", coords: [[-119.06, 35.35], [-119.03, 35.36]] },
    { id: "vp-4", type: "veg_planned", label: "Bakersfield Connector Veg (Q1 2027)", coords: [[-118.99, 35.39], [-118.97, 35.40]] },
  ],
  "SS-104": [
    { id: "ug-5", type: "undergrounded", label: "Foothill East Underground (1.2 mi)", coords: [[-119.24, 37.29], [-119.21, 37.31]] },
    { id: "hp-7", type: "hardened_pole", label: "Pole #F-4401 – Strengthened", coords: [-119.22, 37.30] },
    { id: "vc-5", type: "veg_completed", label: "Pine Flat Rd Veg Clear (1.6 mi)", coords: [[-119.26, 37.28], [-119.23, 37.29]] },
    { id: "vp-5", type: "veg_planned", label: "Trimmer Springs Veg (Q3 2026)", coords: [[-119.19, 37.32], [-119.17, 37.33]] },
  ],
  "SS-203": [
    { id: "ug-6", type: "undergrounded", label: "Mission St Underground (2.4 mi)", coords: [[-122.44, 37.75], [-122.41, 37.77]] },
    { id: "hp-8", type: "hardened_pole", label: "Pole #SF-7701 – Strengthened", coords: [-122.42, 37.76] },
    { id: "hp-9", type: "hardened_pole", label: "Pole #SF-7715 – Strengthened", coords: [-122.40, 37.77] },
    { id: "vc-6", type: "veg_completed", label: "Twin Peaks Veg Clear (0.9 mi)", coords: [[-122.45, 37.74], [-122.43, 37.75]] },
    { id: "vp-6", type: "veg_planned", label: "Glen Park Corridor Veg (Q4 2026)", coords: [[-122.39, 37.78], [-122.37, 37.79]] },
  ],
  "SS-102": [
    { id: "ug-7", type: "undergrounded", label: "Valley Central Underground (1.6 mi)", coords: [[-119.81, 36.72], [-119.78, 36.74]] },
    { id: "hp-10", type: "hardened_pole", label: "Pole #V-2201 – Strengthened", coords: [-119.79, 36.73] },
    { id: "vc-7", type: "veg_completed", label: "Kings River Veg Clear (2.0 mi)", coords: [[-119.83, 36.71], [-119.80, 36.72]] },
    { id: "vp-7", type: "veg_planned", label: "Hanford Connector Veg (Q2 2027)", coords: [[-119.76, 36.75], [-119.74, 36.76]] },
  ],
  "SS-301": [
    { id: "ug-8", type: "undergrounded", label: "Sonoma Hwy Underground (1.9 mi)", coords: [[-122.73, 38.43], [-122.70, 38.45]] },
    { id: "hp-11", type: "hardened_pole", label: "Pole #SN-5501 – Strengthened", coords: [-122.71, 38.44] },
    { id: "hp-12", type: "hardened_pole", label: "Pole #SN-5512 – Strengthened", coords: [-122.69, 38.45] },
    { id: "vc-8", type: "veg_completed", label: "Bennett Valley Veg Clear (1.4 mi)", coords: [[-122.74, 38.42], [-122.72, 38.43]] },
    { id: "vp-8", type: "veg_planned", label: "Mark West Springs Veg (Q1 2027)", coords: [[-122.68, 38.46], [-122.66, 38.47]] },
  ],
};

export function getInfraForSubstation(ssId: string | undefined): InfraSegment[] {
  if (!ssId) return [];
  return INFRA_BY_SS[ssId] ?? [];
}

/* ── Infrastructure segment types & data ─────────────────── */

export interface InfraSegment {
  id: string;
  type: "undergrounded" | "hardened_pole" | "veg_completed" | "veg_planned";
  label: string;
  coords: [number, number][] | [number, number];
  /** Extended metadata shown in click-to-inspect popups */
  meta?: {
    completedDate?: string;
    contractor?: string;
    lengthMi?: number;
    status?: string;
    notes?: string;
    nextInspection?: string;
    workOrderId?: string;
  };
}

export const LAYER_META: Record<InfraSegment["type"], { color: string; label: string; dash?: number[]; icon: string }> = {
  undergrounded: { color: "#22C55E", label: "Undergrounded", icon: "⬇️" },
  hardened_pole: { color: "#3B82F6", label: "Hardened Poles", icon: "🔩" },
  veg_completed: { color: "#A3E635", label: "Veg Mgmt – Done", dash: [2, 2], icon: "✅" },
  veg_planned:   { color: "#FACC15", label: "Veg Mgmt – Planned", dash: [4, 4], icon: "📋" },
};

const INFRA_BY_SS: Record<string, InfraSegment[]> = {
  "SS-201": [
    { id: "ug-1", type: "undergrounded", label: "Page Mill Rd Underground (2.1 mi)", coords: [[-122.16, 37.42], [-122.13, 37.43]], meta: { completedDate: "2024-11-15", contractor: "Quanta Services", lengthMi: 2.1, status: "Complete", workOrderId: "WO-2024-4412", nextInspection: "2025-11-15", notes: "69kV feeder relocated 6ft below grade. Concrete duct bank." } },
    { id: "hp-1", type: "hardened_pole", label: "Pole #A-4412 – Strengthened", coords: [-122.145, 37.435], meta: { completedDate: "2025-03-22", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0312", nextInspection: "2026-03-22", notes: "Steel replacement, Class 1. Wind-rated 110 mph." } },
    { id: "hp-2", type: "hardened_pole", label: "Pole #A-4419 – Strengthened", coords: [-122.138, 37.438], meta: { completedDate: "2025-03-28", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0318", nextInspection: "2026-03-28", notes: "Composite pole, fire-resistant coating applied." } },
    { id: "vc-1", type: "veg_completed", label: "Arastradero Veg Clear (0.8 mi)", coords: [[-122.17, 37.39], [-122.155, 37.395]], meta: { completedDate: "2025-01-10", contractor: "Davey Tree", lengthMi: 0.8, status: "Complete", workOrderId: "WO-2025-V001", nextInspection: "2025-07-10", notes: "15ft clearance achieved. 42 trees trimmed, 3 hazard trees removed." } },
    { id: "vp-1", type: "veg_planned", label: "Foothill Expwy Veg (Q3 2026)", coords: [[-122.12, 37.44], [-122.10, 37.45]], meta: { lengthMi: 1.3, status: "Scheduled", workOrderId: "WO-2026-V010", notes: "Pre-survey completed. 28 trees flagged for trimming. Environmental review pending." } },
  ],
  "SS-202": [
    { id: "ug-2", type: "undergrounded", label: "Stevens Creek Underground (1.4 mi)", coords: [[-121.91, 37.32], [-121.89, 37.34]], meta: { completedDate: "2025-02-20", contractor: "MYR Group", lengthMi: 1.4, status: "Complete", workOrderId: "WO-2025-2205", nextInspection: "2026-02-20", notes: "12kV distribution. HDPE conduit, 4ft depth." } },
    { id: "hp-3", type: "hardened_pole", label: "Pole #B-2205 – Strengthened", coords: [-121.90, 37.33], meta: { completedDate: "2025-06-14", contractor: "Sturgeon Electric", status: "Complete", workOrderId: "WO-2025-0614", nextInspection: "2026-06-14", notes: "Ductile iron pole. Includes covered conductor span." } },
    { id: "vc-2", type: "veg_completed", label: "Saratoga Hills Veg Clear (1.1 mi)", coords: [[-121.93, 37.30], [-121.91, 37.31]], meta: { completedDate: "2024-12-05", contractor: "Asplundh", lengthMi: 1.1, status: "Complete", workOrderId: "WO-2024-V022", nextInspection: "2025-06-05", notes: "High-fire-risk zone. Enhanced clearance to 20ft." } },
    { id: "vp-2", type: "veg_planned", label: "Prospect Rd Veg (Q4 2026)", coords: [[-121.88, 37.35], [-121.87, 37.36]], meta: { lengthMi: 0.9, status: "Pending Approval", workOrderId: "WO-2026-V020", notes: "Requires city permit. Heritage oak assessment in progress." } },
  ],
  "SS-101": [
    { id: "ug-3", type: "undergrounded", label: "Sierra Vista Underground (1.8 mi)", coords: [[-119.30, 37.24], [-119.27, 37.26]], meta: { completedDate: "2024-09-30", contractor: "Pike Electric", lengthMi: 1.8, status: "Complete", workOrderId: "WO-2024-1102", nextInspection: "2025-09-30", notes: "Rural feeder. Trenched through granite, 3ft depth min." } },
    { id: "hp-4", type: "hardened_pole", label: "Pole #N-1102 – Strengthened", coords: [-119.28, 37.25], meta: { completedDate: "2025-04-18", contractor: "Michels Corp", status: "Complete", workOrderId: "WO-2025-0418", nextInspection: "2026-04-18", notes: "Steel monopole with raptor guard. Serves 3 laterals." } },
    { id: "vc-3", type: "veg_completed", label: "Bass Lake Veg Clear (2.3 mi)", coords: [[-119.32, 37.22], [-119.29, 37.23]], meta: { completedDate: "2025-05-20", contractor: "Wright Tree Service", lengthMi: 2.3, status: "Complete", workOrderId: "WO-2025-V030", nextInspection: "2025-11-20", notes: "Dense Ponderosa pine corridor. 67 trees trimmed, 11 removed." } },
    { id: "vp-3", type: "veg_planned", label: "Road 200 Veg (Q2 2026)", coords: [[-119.25, 37.27], [-119.23, 37.28]], meta: { lengthMi: 1.5, status: "Scheduled", workOrderId: "WO-2026-V031", notes: "USFS coordination required. Timber sale agreement pending." } },
  ],
  "SS-103": [
    { id: "ug-4", type: "undergrounded", label: "South Ridge Blvd Underground (1.5 mi)", coords: [[-119.04, 35.36], [-119.01, 35.38]], meta: { completedDate: "2025-01-28", contractor: "Quanta Services", lengthMi: 1.5, status: "Complete", workOrderId: "WO-2025-3301", nextInspection: "2026-01-28", notes: "33kV feeder. Directional bore under SR-178." } },
    { id: "hp-5", type: "hardened_pole", label: "Pole #S-3301 – Strengthened", coords: [-119.02, 35.37], meta: { completedDate: "2025-07-10", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0710", nextInspection: "2026-07-10", notes: "Fire-wrap applied. Guy-wire anchors re-set in concrete." } },
    { id: "hp-6", type: "hardened_pole", label: "Pole #S-3318 – Strengthened", coords: [-119.00, 35.38], meta: { completedDate: "2025-07-15", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0715", nextInspection: "2026-07-15", notes: "Laminated wood pole with steel base sleeve." } },
    { id: "vc-4", type: "veg_completed", label: "Kern River Rd Veg Clear (1.9 mi)", coords: [[-119.06, 35.35], [-119.03, 35.36]], meta: { completedDate: "2025-03-01", contractor: "Davey Tree", lengthMi: 1.9, status: "Complete", workOrderId: "WO-2025-V040", nextInspection: "2025-09-01", notes: "Riparian buffer maintained. 54 trees trimmed." } },
    { id: "vp-4", type: "veg_planned", label: "Bakersfield Connector Veg (Q1 2027)", coords: [[-118.99, 35.39], [-118.97, 35.40]], meta: { lengthMi: 1.2, status: "Planning", workOrderId: "WO-2027-V041", notes: "Environmental impact study initiated. Endangered species survey required." } },
  ],
  "SS-104": [
    { id: "ug-5", type: "undergrounded", label: "Foothill East Underground (1.2 mi)", coords: [[-119.24, 37.29], [-119.21, 37.31]], meta: { completedDate: "2025-08-12", contractor: "MYR Group", lengthMi: 1.2, status: "Complete", workOrderId: "WO-2025-4401", nextInspection: "2026-08-12", notes: "12kV lateral. Rocky terrain required micro-tunneling." } },
    { id: "hp-7", type: "hardened_pole", label: "Pole #F-4401 – Strengthened", coords: [-119.22, 37.30], meta: { completedDate: "2025-09-05", contractor: "Sturgeon Electric", status: "Complete", workOrderId: "WO-2025-0905", nextInspection: "2026-09-05", notes: "Fiberglass composite. Insulated crossarm installed." } },
    { id: "vc-5", type: "veg_completed", label: "Pine Flat Rd Veg Clear (1.6 mi)", coords: [[-119.26, 37.28], [-119.23, 37.29]], meta: { completedDate: "2025-06-25", contractor: "Asplundh", lengthMi: 1.6, status: "Complete", workOrderId: "WO-2025-V050", nextInspection: "2025-12-25", notes: "Mixed conifer. 38 trees trimmed, 8 dead trees removed." } },
    { id: "vp-5", type: "veg_planned", label: "Trimmer Springs Veg (Q3 2026)", coords: [[-119.19, 37.32], [-119.17, 37.33]], meta: { lengthMi: 1.1, status: "Scheduled", workOrderId: "WO-2026-V051", notes: "Access road improvements needed first. Budget approved." } },
  ],
  "SS-203": [
    { id: "ug-6", type: "undergrounded", label: "Mission St Underground (2.4 mi)", coords: [[-122.44, 37.75], [-122.41, 37.77]], meta: { completedDate: "2024-06-18", contractor: "Quanta Services", lengthMi: 2.4, status: "Complete", workOrderId: "WO-2024-7701", nextInspection: "2025-06-18", notes: "Downtown corridor. Concrete-encased duct bank, 5ft depth." } },
    { id: "hp-8", type: "hardened_pole", label: "Pole #SF-7701 – Strengthened", coords: [-122.42, 37.76], meta: { completedDate: "2025-02-14", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0214", nextInspection: "2026-02-14", notes: "Seismic-rated steel monopole. Camera mount added." } },
    { id: "hp-9", type: "hardened_pole", label: "Pole #SF-7715 – Strengthened", coords: [-122.40, 37.77], meta: { completedDate: "2025-02-20", contractor: "PAR Electric", status: "Complete", workOrderId: "WO-2025-0220", nextInspection: "2026-02-20", notes: "Replaced wood with steel. Anti-climbing guards installed." } },
    { id: "vc-6", type: "veg_completed", label: "Twin Peaks Veg Clear (0.9 mi)", coords: [[-122.45, 37.74], [-122.43, 37.75]], meta: { completedDate: "2025-04-02", contractor: "Davey Tree", lengthMi: 0.9, status: "Complete", workOrderId: "WO-2025-V060", nextInspection: "2025-10-02", notes: "Eucalyptus removal in fire zone. 19 trees removed, 31 trimmed." } },
    { id: "vp-6", type: "veg_planned", label: "Glen Park Corridor Veg (Q4 2026)", coords: [[-122.39, 37.78], [-122.37, 37.79]], meta: { lengthMi: 1.0, status: "Pending Approval", workOrderId: "WO-2026-V061", notes: "Community outreach required. Heritage tree review in progress." } },
  ],
  "SS-102": [
    { id: "ug-7", type: "undergrounded", label: "Valley Central Underground (1.6 mi)", coords: [[-119.81, 36.72], [-119.78, 36.74]], meta: { completedDate: "2025-05-10", contractor: "Pike Electric", lengthMi: 1.6, status: "Complete", workOrderId: "WO-2025-2201", nextInspection: "2026-05-10", notes: "Agricultural corridor. Irrigation canal crossing via HDD." } },
    { id: "hp-10", type: "hardened_pole", label: "Pole #V-2201 – Strengthened", coords: [-119.79, 36.73], meta: { completedDate: "2025-08-20", contractor: "Michels Corp", status: "Complete", workOrderId: "WO-2025-0820", nextInspection: "2026-08-20", notes: "Treated wood Class H1 pole. Bird diverter installed." } },
    { id: "vc-7", type: "veg_completed", label: "Kings River Veg Clear (2.0 mi)", coords: [[-119.83, 36.71], [-119.80, 36.72]], meta: { completedDate: "2025-02-28", contractor: "Wright Tree Service", lengthMi: 2.0, status: "Complete", workOrderId: "WO-2025-V070", nextInspection: "2025-08-28", notes: "River corridor. Selective trimming only — nesting season protocols." } },
    { id: "vp-7", type: "veg_planned", label: "Hanford Connector Veg (Q2 2027)", coords: [[-119.76, 36.75], [-119.74, 36.76]], meta: { lengthMi: 0.8, status: "Planning", workOrderId: "WO-2027-V071", notes: "Agricultural easement negotiations underway." } },
  ],
  "SS-301": [
    { id: "ug-8", type: "undergrounded", label: "Sonoma Hwy Underground (1.9 mi)", coords: [[-122.73, 38.43], [-122.70, 38.45]], meta: { completedDate: "2024-10-22", contractor: "MYR Group", lengthMi: 1.9, status: "Complete", workOrderId: "WO-2024-5501", nextInspection: "2025-10-22", notes: "Wine country corridor. Bore under 2 creek crossings." } },
    { id: "hp-11", type: "hardened_pole", label: "Pole #SN-5501 – Strengthened", coords: [-122.71, 38.44], meta: { completedDate: "2025-01-30", contractor: "Sturgeon Electric", status: "Complete", workOrderId: "WO-2025-0130", nextInspection: "2026-01-30", notes: "Fire-hardened steel. Fuse-saving recloser added." } },
    { id: "hp-12", type: "hardened_pole", label: "Pole #SN-5512 – Strengthened", coords: [-122.69, 38.45], meta: { completedDate: "2025-02-05", contractor: "Sturgeon Electric", status: "Complete", workOrderId: "WO-2025-0205", nextInspection: "2026-02-05", notes: "Composite pole with lightning arrester upgrade." } },
    { id: "vc-8", type: "veg_completed", label: "Bennett Valley Veg Clear (1.4 mi)", coords: [[-122.74, 38.42], [-122.72, 38.43]], meta: { completedDate: "2025-04-15", contractor: "Asplundh", lengthMi: 1.4, status: "Complete", workOrderId: "WO-2025-V080", nextInspection: "2025-10-15", notes: "Post-Tubbs fire zone. Enhanced 25ft clearance. 48 trees trimmed." } },
    { id: "vp-8", type: "veg_planned", label: "Mark West Springs Veg (Q1 2027)", coords: [[-122.68, 38.46], [-122.66, 38.47]], meta: { lengthMi: 1.7, status: "Scheduled", workOrderId: "WO-2027-V081", notes: "High-priority fire corridor. CalFire coordination in progress." } },
  ],
};

export function getInfraForSubstation(ssId: string | undefined): InfraSegment[] {
  if (!ssId) return [];
  return INFRA_BY_SS[ssId] ?? [];
}

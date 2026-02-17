/* ── Shared Wildfire Types & Utilities ─────────────────────── */

export interface FirePoint {
  latitude: number;
  longitude: number;
  brightness: number;
  acq_date: string;
  acq_time: string;
  confidence: string | number;
  satellite: string;
  frp: number;
  daynight: string;
}

export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export interface Substation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  voltage: string;
  capacityMW: number;
  zone: string;
  status: "Online" | "Reduced" | "Offline";
  servesZips: string[];
}

export interface TransmissionLine {
  id: string;
  name: string;
  coordinates: [number, number][];
  voltage: string;
}

export interface EnrichedFire {
  fire: FirePoint;
  risk: RiskLevel;
  distanceKm: number;
  distanceMi: number;
  localTime: string;
  status: string;
  isApproaching: boolean;
  previousDistanceKm?: number;
  nearestAsset?: string;
  nearestAssetDistKm?: number;
}

/* ── Constants ────────────────────────────────────────────────── */

export const SUBSTATIONS: Substation[] = [
  // Central Valley
  { id: "SS-101", name: "North Substation", latitude: 37.25, longitude: -119.28, voltage: "220kV", capacityMW: 450, zone: "Zone A — North Highlands", status: "Online", servesZips: ["93644", "93614", "93623"] },
  { id: "SS-102", name: "Valley Substation", latitude: 36.73, longitude: -119.79, voltage: "110kV", capacityMW: 280, zone: "Zone B — Valley Central", status: "Online", servesZips: ["93210", "93242", "93230", "93611"] },
  { id: "SS-103", name: "South Ridge Substation", latitude: 35.37, longitude: -119.02, voltage: "110kV", capacityMW: 320, zone: "Zone C — South Ridge", status: "Reduced", servesZips: ["93637", "93602", "93604", "93301"] },
  { id: "SS-104", name: "Foothill Substation", latitude: 37.30, longitude: -119.22, voltage: "66kV", capacityMW: 150, zone: "Zone D — Foothill East", status: "Online", servesZips: ["93654", "93667", "93651"] },
  // Bay Area
  { id: "SS-201", name: "Peninsula Substation", latitude: 37.44, longitude: -122.14, voltage: "220kV", capacityMW: 500, zone: "Zone E — Peninsula", status: "Online", servesZips: ["94301", "94022", "94043"] },
  { id: "SS-202", name: "South Bay Substation", latitude: 37.34, longitude: -121.89, voltage: "110kV", capacityMW: 380, zone: "Zone F — South Bay", status: "Online", servesZips: ["95050", "95123", "94086", "94087"] },
  { id: "SS-203", name: "San Francisco Substation", latitude: 37.76, longitude: -122.42, voltage: "220kV", capacityMW: 420, zone: "Zone G — SF Metro", status: "Online", servesZips: ["94110"] },
  // North Coast
  { id: "SS-301", name: "Sonoma Substation", latitude: 38.44, longitude: -122.71, voltage: "110kV", capacityMW: 250, zone: "Zone H — Sonoma County", status: "Online", servesZips: ["95401", "95403"] },
  { id: "SS-302", name: "East Bay Substation", latitude: 37.80, longitude: -122.27, voltage: "220kV", capacityMW: 400, zone: "Zone I — East Bay", status: "Online", servesZips: ["94612"] },
  { id: "SS-303", name: "Ukiah Substation", latitude: 39.15, longitude: -123.21, voltage: "66kV", capacityMW: 120, zone: "Zone J — Mendocino", status: "Online", servesZips: ["95482"] },
  // Sierra
  { id: "SS-401", name: "Nevada City Substation", latitude: 39.26, longitude: -121.02, voltage: "66kV", capacityMW: 100, zone: "Zone K — Sierra Foothills", status: "Reduced", servesZips: ["95959"] },
  { id: "SS-402", name: "Truckee Substation", latitude: 39.33, longitude: -120.18, voltage: "110kV", capacityMW: 180, zone: "Zone L — North Sierra", status: "Online", servesZips: ["96161"] },
];

export const TRANSMISSION_LINES: TransmissionLine[] = [
  {
    id: "TL-01",
    name: "North–Valley Line",
    coordinates: [[-119.28, 37.25], [-119.35, 37.18]],
    voltage: "220kV",
  },
];

export const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: "#DC2626",
  High: "#EF4444",
  Medium: "#F97316",
  Low: "#EAB308",
};

export const ASSET_ZONES = [
  { km: 30, label: "Monitoring", color: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.30)" },
  { km: 10, label: "High Risk", color: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.40)" },
  { km: 5, label: "Critical", color: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.50)" },
];

/* ── Functions ────────────────────────────────────────────────── */

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getRisk(distanceKm: number, frp: number, approaching: boolean = false): RiskLevel {
  if (distanceKm <= 5 && frp > 1) return "Critical";
  if (distanceKm <= 10 && approaching) return "High";
  if (distanceKm <= 30) return "Medium";
  return "Low";
}

export function createFireKey(fire: FirePoint): string {
  return `${fire.latitude.toFixed(3)}-${fire.longitude.toFixed(3)}-${fire.acq_date}`;
}

export function isApproachingFn(previousDistance: number | undefined, currentDistance: number): boolean {
  return previousDistance !== undefined && currentDistance < previousDistance;
}

export function formatLocalTime(acq_date: string, acq_time: string): string {
  if (!acq_date) return "Recently";
  const padded = (acq_time || "0000").padStart(4, "0");
  try {
    const d = new Date(`${acq_date}T${padded.slice(0, 2)}:${padded.slice(2)}:00Z`);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return acq_date;
  }
}

export function getNearestAsset(lat: number, lng: number): { name: string; distKm: number } {
  let nearest = { name: "", distKm: Infinity };
  for (const ss of SUBSTATIONS) {
    const d = haversineKm(lat, lng, ss.latitude, ss.longitude);
    if (d < nearest.distKm) nearest = { name: ss.name, distKm: d };
  }
  return nearest;
}

export function getRecommendedAction(risk: RiskLevel, approaching: boolean): string {
  if (risk === "Critical") return "Immediate Response";
  if (risk === "High" && approaching) return "Field Inspection";
  if (risk === "High") return "Field Inspection";
  if (risk === "Medium") return "Monitor";
  return "Monitor";
}

/** Find the substation serving a customer's ZIP code (or fallback to first) */
export function getSubstationForZip(zip: string): Substation {
  const match = SUBSTATIONS.find((ss) => ss.servesZips.includes(zip));
  return match || SUBSTATIONS[0];
}

export function createGeoJSONCircle(
  center: [number, number],
  radiusKm: number,
  points = 64
): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  const distRadians = radiusKm / 6371;
  const centerLat = (center[1] * Math.PI) / 180;
  const centerLng = (center[0] * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const lat = Math.asin(
      Math.sin(centerLat) * Math.cos(distRadians) +
        Math.cos(centerLat) * Math.sin(distRadians) * Math.cos(angle)
    );
    const lng =
      centerLng +
      Math.atan2(
        Math.sin(angle) * Math.sin(distRadians) * Math.cos(centerLat),
        Math.cos(distRadians) - Math.sin(centerLat) * Math.sin(lat)
      );
    coords.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: {},
      },
    ],
  };
}

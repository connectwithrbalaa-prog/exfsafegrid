import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, MapPin, Clock, Activity,
} from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

/* ── Types ────────────────────────────────────────────────────── */

interface FirePoint {
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

type RiskLevel = "High" | "Medium" | "Low";
type OverallStatus = "no-threat" | "monitoring" | "immediate-risk";

interface EnrichedFire {
  fire: FirePoint;
  risk: RiskLevel;
  distanceKm: number;
  distanceMi: number;
  localTime: string;
  status: string;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function getRisk(distanceKm: number, frp: number): RiskLevel {
  if (distanceKm <= 10 && frp > 1) return "High";
  if (distanceKm <= 30 && frp > 0.5) return "Medium";
  if (distanceKm <= 50) return "Low";
  return "Low"; // Fires > 50km still classified as Low for display, but filtered out elsewhere
}

function formatLocalTime(acq_date: string, acq_time: string): string {
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

function getOverallStatus(enriched: EnrichedFire[]): OverallStatus {
  const within50 = enriched.filter((e) => e.distanceKm <= 50);
  if (within50.some((e) => e.risk === "High" && e.distanceKm <= 10)) return "immediate-risk";
  if (within50.length > 0) return "monitoring";
  return "no-threat";
}

const STATUS_CONFIG: Record<OverallStatus, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  "no-threat": {
    label: "No Threat",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    icon: ShieldCheck,
  },
  monitoring: {
    label: "Monitoring",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    icon: ShieldAlert,
  },
  "immediate-risk": {
    label: "Immediate Risk",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    icon: ShieldOff,
  },
};

const RISK_COLORS: Record<RiskLevel, string> = { High: "#EF4444", Medium: "#F97316", Low: "#EAB308" };

/* ── Substations ─────────────────────────────────────────────── */

const SUBSTATIONS = [
  { id: "SS-101", name: "North Substation", latitude: 37.25, longitude: -119.28, voltage: "220kV" },
  { id: "SS-102", name: "Valley Substation", latitude: 37.18, longitude: -119.35, voltage: "110kV" },
];

/* ── Transmission Lines ──────────────────────────────────────── */

const TRANSMISSION_LINES = [
  {
    id: "TL-01",
    name: "North–Valley Line",
    coordinates: [[-119.28, 37.25], [-119.35, 37.18]],
    voltage: "220kV",
  },
];

/* ── Radius zone definitions (km → meters) ─────────────────── */

const ZONES = [
  { km: 50, label: "Monitoring Zone", color: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.35)" },
  { km: 30, label: "Medium Risk Zone", color: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.45)" },
  { km: 10, label: "High Risk Zone", color: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.55)" },
];

/* ── Component ────────────────────────────────────────────────── */

interface Props {
  customerZip?: string;
  assetLat?: number;
  assetLng?: number;
}

export default function CustomerWildfireMap({
  customerZip,
  assetLat = 37.20,
  assetLng = -119.30,
}: Props) {
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  /* ── Fetch ──────────────────────────────────────────────── */

  const fetchFires = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("firms-fires");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setFires(data.fires || []);
    } catch (e: any) {
      console.error("Failed to fetch fire data:", e);
      setError(e.message || "Failed to load fire data");
      toast.error("Failed to load wildfire data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFires();
  }, [fetchFires]);

  /* ── Enrich fires ───────────────────────────────────────── */

  const enriched = useMemo<EnrichedFire[]>(() => {
    return fires
      .map((f) => {
        const distanceKm = haversineKm(assetLat, assetLng, f.latitude, f.longitude);
        return {
          fire: f,
          risk: getRisk(distanceKm, f.frp),
          distanceKm,
          distanceMi: Math.round(distanceKm * 0.621371),
          localTime: formatLocalTime(f.acq_date, f.acq_time),
          status: f.frp > 1.5 ? "Action Recommended" : "Monitoring",
        };
      })
      .filter((f) => f.distanceKm <= 50) // Only include fires within monitoring zone
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [fires, assetLat, assetLng]);

  const within50 = useMemo(() => enriched.filter((e) => e.distanceKm <= 50), [enriched]);
  const highRiskCount = useMemo(() => within50.filter((e) => e.risk === "High").length, [within50]);
  const closestDist = within50.length > 0 ? within50[0].distanceMi : null;
  const overallStatus = useMemo(() => getOverallStatus(enriched), [enriched]);
  const statusCfg = STATUS_CONFIG[overallStatus];
  const StatusIcon = statusCfg.icon;

  /* ── Map init ───────────────────────────────────────────── */

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [assetLng, assetLat],
      zoom: 8,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Asset marker
      new mapboxgl.Marker({ color: "#3B82F6" })
        .setLngLat([assetLng, assetLat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:13px;font-family:system-ui"><b>Your Asset Location</b></div>`
        ))
        .addTo(map);

      // Substation markers
      SUBSTATIONS.forEach((ss) => {
        const el = document.createElement("div");
        el.style.cssText = "width:12px;height:12px;background:#3B82F6;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;";

        new mapboxgl.Marker({ element: el })
          .setLngLat([ss.longitude, ss.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 14, maxWidth: "220px" }).setHTML(
              `<div style="font-family:system-ui;font-size:13px;line-height:1.6;color:#222">
                <div style="font-weight:700;font-size:14px;color:#3B82F6">${ss.name}</div>
                <div style="color:#555;font-size:12px">ID: ${ss.id}<br/>Voltage: ${ss.voltage}</div>
              </div>`
            )
          )
          .addTo(map);
      });

      // Transmission lines
      const tlGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: TRANSMISSION_LINES.map((tl) => ({
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: tl.coordinates },
          properties: { id: tl.id, name: tl.name, voltage: tl.voltage },
        })),
      };

      map.addSource("transmission-lines", { type: "geojson", data: tlGeoJSON });
      map.addLayer({
        id: "transmission-lines-layer",
        type: "line",
        source: "transmission-lines",
        paint: {
          "line-color": "#06B6D4",
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [3, 2],
        },
      });

      // Transmission line hover tooltip
      map.on("mouseenter", "transmission-lines-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "transmission-lines-layer", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "transmission-lines-layer", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates[0];
        const p = f.properties!;
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: "220px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.6;color:#222">
              <div style="font-weight:700;font-size:14px;color:#06B6D4">${p.name}</div>
              <div style="color:#555;font-size:12px">ID: ${p.id}<br/>Voltage: ${p.voltage}</div>
            </div>`
          )
          .addTo(map);
      });

      // Radius zones
      ZONES.forEach((z) => {
        const circle = createGeoJSONCircle([assetLng, assetLat], z.km);
        map.addSource(`zone-${z.km}`, { type: "geojson", data: circle });
        map.addLayer({
          id: `zone-fill-${z.km}`,
          type: "fill",
          source: `zone-${z.km}`,
          paint: { "fill-color": z.color },
        });
        map.addLayer({
          id: `zone-line-${z.km}`,
          type: "line",
          source: `zone-${z.km}`,
          paint: { "line-color": z.border, "line-width": 1.5, "line-dasharray": [4, 3] },
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [assetLat, assetLng]);

  /* ── Update fire data on map (clustered GeoJSON) ────────── */

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateData = () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: fires.slice(0, 5000).map((f) => {
          const dist = haversineKm(assetLat, assetLng, f.latitude, f.longitude);
          const risk = getRisk(dist, f.frp);
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [f.longitude, f.latitude] },
            properties: {
              frp: f.frp,
              risk,
              riskNum: risk === "High" ? 3 : risk === "Medium" ? 2 : 1,
              distKm: Math.round(dist * 10) / 10,
              distMi: Math.round(dist * 0.621371),
              localTime: formatLocalTime(f.acq_date, f.acq_time),
              status: f.frp > 1.5 ? "Action Recommended" : "Monitoring",
            },
          };
        }),
      };

      if (map.getSource("fires")) {
        (map.getSource("fires") as mapboxgl.GeoJSONSource).setData(geojson);
        return;
      }

      map.addSource("fires", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
        clusterProperties: {
          maxRisk: ["max", ["get", "riskNum"]],
        },
      });

      // Cluster circles
      map.addLayer({
        id: "fire-clusters",
        type: "circle",
        source: "fires",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            [">=", ["get", "maxRisk"], 3], RISK_COLORS.High,
            [">=", ["get", "maxRisk"], 2], RISK_COLORS.Medium,
            RISK_COLORS.Low,
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-stroke-opacity": 0.6,
        },
      });

      // Cluster count
      map.addLayer({
        id: "fire-cluster-count",
        type: "symbol",
        source: "fires",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#fff" },
      });

      // Individual fire points
      map.addLayer({
        id: "fire-points",
        type: "circle",
        source: "fires",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "risk"], "High"], RISK_COLORS.High,
            ["==", ["get", "risk"], "Medium"], RISK_COLORS.Medium,
            RISK_COLORS.Low,
          ],
          "circle-radius": [
            "interpolate", ["linear"], ["get", "frp"],
            0, 5, 3, 8, 10, 14, 20, 18,
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-stroke-opacity": 0.5,
        },
      });

      // Click on cluster → zoom in
      map.on("click", "fire-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["fire-clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        (map.getSource("fires") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      // Click on point → popup
      map.on("click", "fire-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates.slice();
        const p = f.properties!;
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: "240px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.7;color:#222">
              <div style="font-weight:700;font-size:15px;margin-bottom:2px;color:${RISK_COLORS[p.risk as RiskLevel] || "#666"}">
                ${p.risk} Risk
              </div>
              <div style="color:#555;font-size:12px">
                📍 ${p.distMi} miles from your asset<br/>
                🕐 ${p.localTime}<br/>
                Status: <b>${p.status}</b>
              </div>
            </div>`
          )
          .addTo(map);
      });

      // Cursors
      map.on("mouseenter", "fire-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fire-clusters", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "fire-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fire-points", () => { map.getCanvas().style.cursor = ""; });
    };

    if (map.isStyleLoaded()) {
      updateData();
    } else {
      map.on("load", updateData);
    }
  }, [fires, assetLat, assetLng]);

  /* ── Alert table data (within 50 km, top 25) ────────────── */

  const tableData = useMemo(() => within50.slice(0, 25), [within50]);

  const riskBadge = (risk: RiskLevel) => {
    const cls =
      risk === "High"
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : risk === "Medium"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}">${risk}</span>`;
  };

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* ── Risk Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Active fires within 50km */}
        <SummaryCard
          icon={<Activity className="w-5 h-5 text-orange-500" />}
          label="Active Fires within 50 km"
          value={loading ? "…" : String(within50.length)}
          loading={loading}
        />
        {/* High risk fires */}
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
          label="High Risk Fires"
          value={loading ? "…" : String(highRiskCount)}
          loading={loading}
          highlight={highRiskCount > 0}
        />
        {/* Closest fire */}
        <SummaryCard
          icon={<MapPin className="w-5 h-5 text-blue-500" />}
          label="Closest Fire Distance"
          value={loading ? "…" : closestDist !== null ? `${closestDist} mi` : "None"}
          loading={loading}
        />
        {/* Overall status */}
        <div className={`rounded-lg border p-4 flex flex-col justify-between ${statusCfg.bg}`}>
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Overall Status</span>
          </div>
          <span className={`text-lg font-bold ${statusCfg.color}`}>{loading ? "…" : statusCfg.label}</span>
        </div>
      </div>

      {/* ── Risk Map ───────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Wildfire Risk Map
          </h3>
          <button
            onClick={fetchFires}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div style={{ height: 480 }} className="relative w-full">
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
          {loading && (
            <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 border border-border rounded-lg px-3.5 py-2.5 text-[11px] space-y-1.5 shadow-sm">
            <div className="font-semibold text-card-foreground mb-1.5 text-xs">Risk Level</div>
            {(["High", "Medium", "Low"] as RiskLevel[]).map((r) => (
              <div key={r} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-white/50" style={{ background: RISK_COLORS[r] }} />
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 mt-1.5">
              <div className="font-semibold text-card-foreground mb-1">Assets</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ background: "#3B82F6", border: "1.5px solid white" }} />
                <span className="text-muted-foreground">Substation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-3 rounded" style={{ background: "#06B6D4", opacity: 0.8 }} />
                <span className="text-muted-foreground">Transmission Line</span>
              </div>
            </div>
            <div className="border-t border-border pt-1.5 mt-1.5">
              <div className="font-semibold text-card-foreground mb-1">Zones</div>
              {ZONES.slice().reverse().map((z) => (
                <div key={z.km} className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded" style={{ background: z.border }} />
                  <span className="text-muted-foreground">{z.km} km – {z.label.replace(" Zone", "")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset pin label */}
          <div className="absolute top-3 left-3 z-[1000] bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Your Asset
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5 border-t border-border">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ── Alert List ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Fire Alerts Near Your Assets
          </h3>
          {within50.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{within50.length} detected within 50 km</span>
          )}
        </div>

        {!loading && tableData.length > 0 ? (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                <tr className="text-left text-muted-foreground text-xs">
                  <th className="px-4 py-2 font-medium">Detection Time</th>
                  <th className="px-4 py-2 font-medium">Distance from Asset</th>
                  <th className="px-4 py-2 font-medium">Risk Level</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableData.map((e, i) => (
                  <tr key={i} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 text-card-foreground">{e.localTime}</td>
                    <td className="px-4 py-2.5 text-card-foreground font-medium">{e.distanceMi} mi</td>
                    <td className="px-4 py-2.5">
                      <RiskBadge risk={e.risk} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${
                        e.status === "Action Recommended"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-green-500" />
            No fires detected within 50 km of your asset.
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        <div className="px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
          Data refreshed automatically · Tap a marker on the map for details
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 flex flex-col justify-between ${
      highlight ? "border-destructive/40 bg-destructive/5" : "border-border"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${highlight ? "text-destructive" : "text-card-foreground"}`}>
        {loading ? "…" : value}
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const cls =
    risk === "High"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : risk === "Medium"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {risk}
    </span>
  );
}

/* ── GeoJSON circle helper ──────────────────────────────────── */

function createGeoJSONCircle(
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

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle,
  Activity, Zap, Radio, TrendingUp, TrendingDown, Minus, Layers, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  FirePoint, RiskLevel, EnrichedFire,
  SUBSTATIONS, TRANSMISSION_LINES, RISK_COLORS, ASSET_ZONES,
  haversineKm, getRisk, createFireKey, isApproachingFn,
  formatLocalTime, getNearestAsset, getRecommendedAction, createGeoJSONCircle,
} from "@/lib/wildfire-utils";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

/* ── Grid status ─────────────────────────────────────────────── */

type GridStatus = "green" | "amber" | "red";

function getGridStatus(enriched: EnrichedFire[]): GridStatus {
  if (enriched.some((e) => e.risk === "Critical")) return "red";
  if (enriched.some((e) => e.risk === "High")) return "amber";
  return "green";
}

const GRID_CONFIG: Record<GridStatus, { label: string; color: string; bg: string; dot: string }> = {
  green: { label: "Normal Operations", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  amber: { label: "Elevated Risk", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  red: { label: "Critical Alert", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", dot: "bg-red-400 animate-pulse" },
};

/* ── Asset risk data ─────────────────────────────────────────── */

interface AssetRisk {
  id: string;
  name: string;
  type: "Substation" | "Transmission";
  voltage: string;
  nearestFireDist: number;
  nearestFireDistMi: number;
  risk: RiskLevel;
  trend: "Approaching" | "Stable";
  action: string;
}

function computeAssetRisks(enriched: EnrichedFire[]): AssetRisk[] {
  const assets: AssetRisk[] = [];

  for (const ss of SUBSTATIONS) {
    let nearest = Infinity;
    let approaching = false;
    let bestFrp = 0;

    for (const e of enriched) {
      const d = haversineKm(ss.latitude, ss.longitude, e.fire.latitude, e.fire.longitude);
      if (d < nearest) {
        nearest = d;
        bestFrp = e.fire.frp;
        approaching = e.isApproaching;
      }
    }

    const risk = nearest < Infinity ? getRisk(nearest, bestFrp, approaching) : "Low";
    assets.push({
      id: ss.id,
      name: ss.name,
      type: "Substation",
      voltage: ss.voltage,
      nearestFireDist: nearest < Infinity ? nearest : -1,
      nearestFireDistMi: nearest < Infinity ? Math.round(nearest * 0.621371) : -1,
      risk,
      trend: approaching ? "Approaching" : "Stable",
      action: getRecommendedAction(risk, approaching),
    });
  }

  for (const tl of TRANSMISSION_LINES) {
    let nearest = Infinity;
    let approaching = false;
    let bestFrp = 0;

    for (const e of enriched) {
      for (const coord of tl.coordinates) {
        const d = haversineKm(coord[1], coord[0], e.fire.latitude, e.fire.longitude);
        if (d < nearest) {
          nearest = d;
          bestFrp = e.fire.frp;
          approaching = e.isApproaching;
        }
      }
    }

    const risk = nearest < Infinity ? getRisk(nearest, bestFrp, approaching) : "Low";
    assets.push({
      id: tl.id,
      name: tl.name,
      type: "Transmission",
      voltage: tl.voltage,
      nearestFireDist: nearest < Infinity ? nearest : -1,
      nearestFireDistMi: nearest < Infinity ? Math.round(nearest * 0.621371) : -1,
      risk,
      trend: approaching ? "Approaching" : "Stable",
      action: getRecommendedAction(risk, approaching),
    });
  }

  const riskOrder: Record<RiskLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return assets.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
}

/* ── Component ────────────────────────────────────────────────── */

export default function CommandCenter() {
  const navigate = useNavigate();
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const fireHistoryRef = useRef<Map<string, number>>(new Map());

  /* ── Fetch ──────────────────────────────────────────────── */

  const fetchFires = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("firms-fires");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFires(data.fires || []);
      setLastUpdated(new Date());
    } catch (e: any) {
      console.error("Failed to fetch fire data:", e);
      toast.error("Failed to load wildfire data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFires(); }, [fetchFires]);

  /* ── Enrich fires relative to ALL assets ───────────────── */

  const enriched = useMemo<EnrichedFire[]>(() => {
    return fires
      .map((f) => {
        const nearest = getNearestAsset(f.latitude, f.longitude);
        const fireKey = createFireKey(f);
        const prev = fireHistoryRef.current.get(fireKey);
        const approaching = isApproachingFn(prev, nearest.distKm);
        fireHistoryRef.current.set(fireKey, nearest.distKm);

        return {
          fire: f,
          risk: getRisk(nearest.distKm, f.frp, approaching),
          distanceKm: nearest.distKm,
          distanceMi: Math.round(nearest.distKm * 0.621371),
          localTime: formatLocalTime(f.acq_date, f.acq_time),
          status: f.frp > 1.5 ? "Action Recommended" : "Monitoring",
          isApproaching: approaching,
          previousDistanceKm: prev,
          nearestAsset: nearest.name,
          nearestAssetDistKm: nearest.distKm,
        };
      })
      .filter((f) => f.distanceKm <= 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [fires]);

  const gridStatus = useMemo(() => getGridStatus(enriched), [enriched]);
  const gridCfg = GRID_CONFIG[gridStatus];
  const criticalCount = enriched.filter((e) => e.risk === "Critical" || e.risk === "High").length;
  const assetRisks = useMemo(() => computeAssetRisks(enriched), [enriched]);
  const assetsAtRisk = assetRisks.filter((a) => a.risk === "Critical" || a.risk === "High").length;

  /* ── Map ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-119.315, 37.215],
      zoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Per-substation risk zones
      SUBSTATIONS.forEach((ss) => {
        ASSET_ZONES.forEach((z) => {
          const circle = createGeoJSONCircle([ss.longitude, ss.latitude], z.km);
          const src = `zone-${ss.id}-${z.km}`;
          map.addSource(src, { type: "geojson", data: circle });
          map.addLayer({ id: `${src}-fill`, type: "fill", source: src, paint: { "fill-color": z.color } });
          map.addLayer({
            id: `${src}-line`, type: "line", source: src,
            paint: { "line-color": z.border, "line-width": 1.5, "line-dasharray": [4, 3] },
          });
        });
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
        id: "transmission-lines-layer", type: "line", source: "transmission-lines",
        paint: { "line-color": "#06B6D4", "line-width": 2, "line-opacity": 0.8, "line-dasharray": [3, 2] },
      });

      // Substation markers
      SUBSTATIONS.forEach((ss) => {
        const el = document.createElement("div");
        el.style.cssText = "width:14px;height:14px;background:#3B82F6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);cursor:pointer;";
        new mapboxgl.Marker({ element: el })
          .setLngLat([ss.longitude, ss.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "220px" }).setHTML(
            `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
              <div style="font-weight:700;color:#60A5FA">${ss.name}</div>
              <div style="color:#94a3b8;font-size:12px">${ss.id} · ${ss.voltage}</div>
            </div>`
          ))
          .addTo(map);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  /* ── Update fires on map ───────────────────────────────── */

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateData = () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: fires.slice(0, 5000).map((f) => {
          const nearest = getNearestAsset(f.latitude, f.longitude);
          const fireKey = createFireKey(f);
          const prev = fireHistoryRef.current.get(fireKey);
          const approaching = isApproachingFn(prev, nearest.distKm);
          const risk = getRisk(nearest.distKm, f.frp, approaching);
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [f.longitude, f.latitude] },
            properties: {
              risk,
              approaching,
              riskNum: risk === "Critical" ? 4 : risk === "High" ? 3 : risk === "Medium" ? 2 : 1,
              distMi: Math.round(nearest.distKm * 0.621371),
              nearestAsset: nearest.name,
              localTime: formatLocalTime(f.acq_date, f.acq_time),
              frp: f.frp,
            },
          };
        }),
      };

      if (map.getSource("fires")) {
        (map.getSource("fires") as mapboxgl.GeoJSONSource).setData(geojson);
        return;
      }

      map.addSource("fires", {
        type: "geojson", data: geojson,
        cluster: true, clusterMaxZoom: 12, clusterRadius: 50,
        clusterProperties: { maxRisk: ["max", ["get", "riskNum"]] },
      });

      // Clusters
      map.addLayer({
        id: "fire-clusters", type: "circle", source: "fires",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            [">=", ["get", "maxRisk"], 4], RISK_COLORS.Critical,
            [">=", ["get", "maxRisk"], 3], RISK_COLORS.High,
            [">=", ["get", "maxRisk"], 2], RISK_COLORS.Medium,
            RISK_COLORS.Low,
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 20, 50, 28],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      });
      map.addLayer({
        id: "fire-cluster-count", type: "symbol", source: "fires",
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"], "text-size": 11 },
        paint: { "text-color": "#fff" },
      });

      // Individual points
      map.addLayer({
        id: "fire-points", type: "circle", source: "fires",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "risk"], "Critical"], RISK_COLORS.Critical,
            ["==", ["get", "risk"], "High"], RISK_COLORS.High,
            ["==", ["get", "risk"], "Medium"], RISK_COLORS.Medium,
            RISK_COLORS.Low,
          ],
          "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 4, 3, 7, 10, 12, 20, 16],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.5, "circle-stroke-color": "rgba(255,255,255,0.4)",
        },
      });

      // Click cluster → zoom
      map.on("click", "fire-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["fire-clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        (map.getSource("fires") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      // Click point → popup
      map.on("click", "fire-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates.slice();
        const p = f.properties!;
        const approachTag = p.approaching ? `<span style="color:#f87171;font-weight:700"> · APPROACHING</span>` : "";
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: "260px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.7;color:#e2e8f0">
              <div style="font-weight:700;font-size:14px;color:${RISK_COLORS[p.risk as RiskLevel] || "#aaa"}">${p.risk} Risk${approachTag}</div>
              <div style="color:#94a3b8;font-size:12px">
                ⚡ Nearest: <b>${p.nearestAsset}</b> (${p.distMi} mi)<br/>
                🕐 ${p.localTime}
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "fire-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fire-clusters", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "fire-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fire-points", () => { map.getCanvas().style.cursor = ""; });
    };

    if (map.isStyleLoaded()) updateData();
    else map.on("load", updateData);
  }, [fires]);

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)] text-[hsl(210,40%,93%)]">
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-[hsl(220,25%,8%)]">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Wildfire Executive Command Center</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Situational Awareness · Asset Protection</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-[10px] text-white/30">
                Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchFires}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors disabled:opacity-30 bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-5 space-y-5">
        {/* ── Executive Summary Cards ───────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecCard
            icon={<Activity className="w-5 h-5 text-orange-400" />}
            label="Active Fires"
            sublabel="within 50 km of assets"
            value={loading ? "…" : String(enriched.length)}
            loading={loading}
          />
          <ExecCard
            icon={<Zap className="w-5 h-5 text-blue-400" />}
            label="Assets at Risk"
            sublabel="high or critical exposure"
            value={loading ? "…" : String(assetsAtRisk)}
            loading={loading}
            highlight={assetsAtRisk > 0}
          />
          <ExecCard
            icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
            label="Critical Alerts"
            sublabel="requiring immediate action"
            value={loading ? "…" : String(criticalCount)}
            loading={loading}
            highlight={criticalCount > 0}
          />
          <div className={`rounded-xl border p-4 flex flex-col justify-between ${gridCfg.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${gridCfg.dot}`} />
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Grid Status</span>
            </div>
            <span className={`text-xl font-bold ${gridCfg.color}`}>{loading ? "…" : gridCfg.label}</span>
          </div>
        </div>

        {/* ── Interactive Map ───────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Operational Map — Fire & Asset Overlay
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-white/30">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white/30" /> Substation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-cyan-400 rounded" /> Transmission
              </span>
              {(["Critical", "High", "Medium", "Low"] as RiskLevel[]).map((r) => (
                <span key={r} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: RISK_COLORS[r] }} />
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 520 }} className="relative w-full">
            <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
            {loading && (
              <div className="absolute inset-0 z-[1000] bg-black/50 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-white/50" />
              </div>
            )}
          </div>
        </div>

        {/* ── Critical Asset Table ─────────────────────────── */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Critical Asset Status
            </h2>
            <span className="text-[10px] text-white/30">
              {assetRisks.length} assets monitored
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-medium">Asset Name</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Nearest Fire</th>
                  <th className="px-5 py-3 font-medium">Risk Level</th>
                  <th className="px-5 py-3 font-medium">Trend</th>
                  <th className="px-5 py-3 font-medium">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {assetRisks.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3 text-white/50">
                      <span className="inline-flex items-center gap-1">
                        {a.type === "Substation" ? <Zap className="w-3 h-3 text-blue-400" /> : <Minus className="w-3 h-3 text-cyan-400" />}
                        {a.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {a.nearestFireDist >= 0 ? `${a.nearestFireDistMi} mi` : "No fires"}
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge risk={a.risk} />
                    </td>
                    <td className="px-5 py-3">
                      <TrendBadge trend={a.trend} />
                    </td>
                    <td className="px-5 py-3">
                      <ActionBadge action={a.action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2 border-t border-white/[0.04] text-[10px] text-white/20">
            Risk calculated from fire proximity, intensity (FRP), and approach trend · No raw coordinates or satellite metadata displayed
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function ExecCard({ icon, label, sublabel, value, loading, highlight }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col justify-between bg-[hsl(220,25%,9%)] ${
      highlight ? "border-red-500/30 bg-red-500/5" : "border-white/[0.08]"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div>
          <span className="text-[11px] font-medium text-white/60 block leading-tight">{label}</span>
          <span className="text-[9px] text-white/25 uppercase tracking-wider">{sublabel}</span>
        </div>
      </div>
      <span className={`text-3xl font-bold tabular-nums ${highlight ? "text-red-400" : "text-white/90"}`}>
        {loading ? "…" : value}
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    Critical: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40",
    High: "bg-orange-500/15 text-orange-300",
    Medium: "bg-amber-500/15 text-amber-300",
    Low: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[risk]}`}>
      {risk}
    </span>
  );
}

function TrendBadge({ trend }: { trend: "Approaching" | "Stable" }) {
  if (trend === "Approaching") {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
        <TrendingUp className="w-3.5 h-3.5" />
        Approaching
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-white/30 text-xs font-medium">
      <TrendingDown className="w-3.5 h-3.5" />
      Stable
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action === "Immediate Response"
      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
      : action === "Field Inspection"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-white/5 text-white/40";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {action}
    </span>
  );
}

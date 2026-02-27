/**
 * GisWorkspace — Network layers, map tools, export utilities.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Layers, Route, Cloud, Flame, Activity, Download, RefreshCw,
  Volume2, VolumeX, ShieldAlert, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCircuitIgnitionRisk } from "@/hooks/use-backend-data";
import { downloadCsv, formatAssetRiskCsv } from "@/lib/csv-export";
import {
  FirePoint, RiskLevel,
  SUBSTATIONS, TRANSMISSION_LINES, RISK_COLORS,
  haversineKm, getRisk, createFireKey,
  formatLocalTime, getNearestAsset, getRecommendedAction,
} from "@/lib/wildfire-utils";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

export default function GisWorkspace() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEvac, setShowEvac] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showSpread, setShowSpread] = useState(false);
  const [showIgnition, setShowIgnition] = useState(false);
  const circuitRiskQuery = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 500 });

  const fetchFires = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("firms-fires");
      if (!error && data?.fires) setFires(data.fires);
    } catch { /* swallow */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFires(); }, [fetchFires]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-119.5, 37.5],
      zoom: 5.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Substations
    SUBSTATIONS.forEach((ss) => {
      new mapboxgl.Marker({ color: "#3b82f6", scale: 0.6 })
        .setLngLat([ss.longitude, ss.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(
          `<div style="font-size:12px"><strong>${ss.name}</strong><br/>${ss.capacityMW} MW · ${ss.voltage} kV</div>`
        ))
        .addTo(map);
    });

    // Transmission lines
    map.on("load", () => {
      TRANSMISSION_LINES.forEach((tl, i) => {
        map.addSource(`tl-${i}`, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: tl.coordinates.map((p) => [p[1], p[0]]) },
            properties: {},
          },
        });
        map.addLayer({
          id: `tl-${i}`,
          type: "line",
          source: `tl-${i}`,
          paint: { "line-color": "#06b6d4", "line-width": 1.5, "line-opacity": 0.4 },
        });
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Fire markers
  useEffect(() => {
    if (!mapRef.current) return;
    fires.forEach((f) => {
      const el = document.createElement("div");
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${f.confidence === "high" ? "#ef4444" : "#f59e0b"};border:1px solid rgba(0,0,0,0.3);`;
      new mapboxgl.Marker(el)
        .setLngLat([f.longitude, f.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
          `<div style="font-size:11px;"><strong>Fire</strong><br/>Confidence: ${f.confidence}<br/>FRP: ${f.frp?.toFixed(1) ?? "—"} MW</div>`
        ))
        .addTo(mapRef.current!);
    });
  }, [fires]);

  // Compute asset risks for export (substations only — they have lat/lon)
  const assetRisks = SUBSTATIONS.map((a) => {
    const nearest = fires.reduce(
      (best, f) => {
        const d = haversineKm(a.latitude, a.longitude, f.latitude, f.longitude);
        return d < best.dist ? { dist: d, fire: f } : best;
      },
      { dist: Infinity, fire: null as FirePoint | null }
    );
    return {
      id: a.id,
      name: a.name,
      type: "Substation" as const,
      risk: getRisk(nearest.dist, nearest.fire?.frp ?? 0) as RiskLevel,
      nearestFireDist: nearest.dist,
      nearestFireDistMi: nearest.dist < Infinity ? (nearest.dist * 0.621371).toFixed(1) : "—",
      voltage: a.voltage,
    };
  });

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold flex items-center gap-2 mr-4">
          <MapPin className="w-4 h-4 text-blue-400" /> GIS Network View
        </h2>
        {([
          { key: "evac", label: "Evac Routes", state: showEvac, set: setShowEvac, icon: Route, color: "emerald" },
          { key: "weather", label: "Weather", state: showWeather, set: setShowWeather, icon: Cloud, color: "sky" },
          { key: "spread", label: "Spread", state: showSpread, set: setShowSpread, icon: Flame, color: "rose" },
          { key: "ignition", label: "Ignition", state: showIgnition, set: setShowIgnition, icon: Activity, color: "orange" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => t.set(!t.state)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
              t.state
                ? `bg-${t.color}-500/15 border-${t.color}-500/30 text-${t.color}-300`
                : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
            }`}
          >
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
        <button
          onClick={fetchFires}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10 ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {assetRisks.length > 0 && (
          <button
            onClick={() => downloadCsv(formatAssetRiskCsv(assetRisks), "gis-asset-risks.csv")}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden relative" style={{ height: 520 }}>
        <div ref={mapContainerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-black/50 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-white/50" />
          </div>
        )}
      </div>

      {/* Asset Summary */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" /> Network Assets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Substations" value={String(SUBSTATIONS.length)} />
          <StatCard label="Transmission Lines" value={String(TRANSMISSION_LINES.length)} />
          <StatCard label="Active Fires" value={String(fires.length)} highlight={fires.length > 0} />
          <StatCard label="Assets at Risk" value={String(assetRisks.filter((a) => a.risk === "Critical" || a.risk === "High").length)} highlight />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? "border-red-500/30 bg-red-500/5" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-red-400" : ""}`}>{value}</div>
    </div>
  );
}

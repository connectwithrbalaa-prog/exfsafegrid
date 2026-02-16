import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle,
  Activity, Zap, Radio, TrendingUp, TrendingDown, Minus, Layers, ArrowLeft, MapPin, BarChart3, Route, Shield, DollarSign, Cloud, Clock, Flame,
} from "lucide-react";
import HvraPanel, { CATEGORY_CONFIG, type HvraAsset } from "@/components/HvraPanel";
import NvcDashboard from "@/components/NvcDashboard";
import EvacuationPanel from "@/components/EvacuationPanel";
import ResourceTracker from "@/components/ResourceTracker";
import InsuranceRiskPanel from "@/components/InsuranceRiskPanel";
import FireHistoryTimeline from "@/components/FireHistoryTimeline";
import FireBehaviorPanel from "@/components/FireBehaviorPanel";
import {
  EVAC_ROUTES, BOTTLENECKS, ROUTE_STYLES, BOTTLENECK_STYLES, BOTTLENECK_ICONS,
} from "@/lib/evacuation-data";
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
  const [activeTab, setActiveTab] = useState<"assets" | "hvra" | "nvc" | "evac" | "resources" | "insurance" | "history" | "behavior">("assets");
  const [hvraAssets, setHvraAssets] = useState<HvraAsset[]>([]);
  const [showEvacRoutes, setShowEvacRoutes] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const weatherMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [showSpreadPrediction, setShowSpreadPrediction] = useState(false);
  const spreadMarkersRef = useRef<mapboxgl.Marker[]>([]);
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

  // Fetch HVRA assets
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("hvra_assets").select("*");
      if (data) setHvraAssets(data as unknown as HvraAsset[]);
    })();
  }, []);

  // Fetch weather data
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("weather");
        if (!error && data?.weather) setWeatherData(data.weather);
      } catch (e) {
        console.error("Weather fetch failed:", e);
      }
    })();
  }, []);

  // Render / toggle weather markers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing weather markers
    weatherMarkersRef.current.forEach((m) => m.remove());
    weatherMarkersRef.current = [];

    if (!showWeather || weatherData.length === 0) return;

    const getWindArrow = (deg: number) => {
      const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
      return arrows[Math.round(deg / 45) % 8];
    };

    const getHumidityColor = (h: number) => {
      if (h < 20) return "#EF4444";
      if (h < 40) return "#F97316";
      if (h < 60) return "#FBBF24";
      return "#34D399";
    };

    weatherData.forEach((w: any) => {
      const humColor = getHumidityColor(w.humidity_pct);
      const el = document.createElement("div");
      el.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:1px;background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:4px 6px;min-width:56px;font-family:system-ui;cursor:pointer;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
      el.innerHTML = `<div style="font-size:13px;font-weight:700;color:#F8FAFC;line-height:1">${Math.round(w.temperature_f)}°F</div><div style="font-size:10px;color:${humColor};font-weight:600;line-height:1.2">${w.humidity_pct}% RH</div><div style="font-size:10px;color:#94A3B8;line-height:1.2">${getWindArrow(w.wind_direction_deg)} ${Math.round(w.wind_speed_mph)} mph</div>`;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([w.longitude, w.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "220px" }).setHTML(
          `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
            <div style="font-weight:700;color:#60A5FA">${w.label}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:4px;line-height:1.6">
              🌡 Temperature: <b>${w.temperature_f}°F</b><br/>
              💧 Humidity: <b style="color:${humColor}">${w.humidity_pct}%</b><br/>
              💨 Wind: <b>${w.wind_speed_mph} mph</b> ${getWindArrow(w.wind_direction_deg)} (${w.wind_direction_deg}°)<br/>
              ${w.humidity_pct < 25 ? '<div style="color:#EF4444;font-weight:700;margin-top:4px">⚠ LOW HUMIDITY — Fire Weather Alert</div>' : ""}
            </div>
          </div>`
        ))
        .addTo(map);

      weatherMarkersRef.current.push(marker);
    });
  }, [showWeather, weatherData]);

  // Spread prediction arrows on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    spreadMarkersRef.current.forEach((m) => m.remove());
    spreadMarkersRef.current = [];
    if (!showSpreadPrediction || fires.length === 0 || weatherData.length === 0) return;

    // Quick Rothermel for each fire near a weather station
    const seen = new Set<string>();
    fires.forEach((fire) => {
      // Find nearest weather
      let bestW: any = null;
      let bestD = Infinity;
      for (const w of weatherData) {
        const d = haversineKm(fire.latitude, fire.longitude, w.latitude, w.longitude);
        if (d < bestD) { bestD = d; bestW = w; }
      }
      if (!bestW || bestD > 30) return;
      const cellKey = `${Math.round(fire.latitude * 10)}-${Math.round(fire.longitude * 10)}`;
      if (seen.has(cellKey)) return;
      seen.add(cellKey);

      // Simplified direction: wind pushes fire downwind
      const spreadDir = (bestW.wind_direction_deg + 180) % 360;
      const speed = bestW.wind_speed_mph;
      const severity = speed > 15 ? "#DC2626" : speed > 8 ? "#F97316" : "#FBBF24";

      const el = document.createElement("div");
      el.style.cssText = `width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;`;
      el.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" style="transform:rotate(${spreadDir}deg)">
        <polygon points="14,2 22,22 14,17 6,22" fill="${severity}" fill-opacity="0.7" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
      </svg>`;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([fire.longitude, fire.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "200px" }).setHTML(
          `<div style="font-family:system-ui;font-size:12px;color:#e2e8f0">
            <div style="font-weight:700;color:${severity}">Spread Direction</div>
            <div style="color:#94a3b8;font-size:11px;margin-top:2px">
              Direction: ${spreadDir}° · Wind: ${speed} mph<br/>
              Station: ${bestW.label}
            </div>
          </div>`
        ))
        .addTo(map);
      spreadMarkersRef.current.push(marker);
    });
  }, [showSpreadPrediction, fires, weatherData]);

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

      // HVRA markers (non-substation assets)
      hvraAssets
        .filter((a) => a.category !== "Substation")
        .forEach((a) => {
          const cfg = CATEGORY_CONFIG[a.category] || { mapColor: "#A78BFA" };
          const el = document.createElement("div");
          el.style.cssText = `width:12px;height:12px;background:${cfg.mapColor};border:2px solid rgba(255,255,255,0.7);border-radius:3px;box-shadow:0 0 6px ${cfg.mapColor}80;cursor:pointer;`;
          new mapboxgl.Marker({ element: el })
            .setLngLat([a.longitude, a.latitude])
            .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "240px" }).setHTML(
              `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
                <div style="font-weight:700;color:${cfg.mapColor}">${a.name}</div>
                <div style="color:#94a3b8;font-size:11px">${a.category}${a.subcategory ? ` · ${a.subcategory}` : ""}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:2px">Weight: ${a.importance_weight}/10 · ${a.response_function}</div>
                ${a.population_served > 0 ? `<div style="color:#94a3b8;font-size:11px">Pop: ${a.population_served.toLocaleString()}</div>` : ""}
              </div>`
            ))
            .addTo(map);
        });

      // Evacuation routes
      EVAC_ROUTES.forEach((r) => {
        const style = ROUTE_STYLES[r.type];
        const srcId = `evac-route-${r.id}`;
        map.addSource(srcId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: r.coordinates },
            properties: { name: r.name, type: r.type, capacity: r.capacityVehiclesHr, length: r.lengthMi },
          },
        });
        map.addLayer({
          id: `${srcId}-layer`,
          type: "line",
          source: srcId,
          paint: {
            "line-color": style.color,
            "line-width": style.width,
            "line-opacity": 0.85,
            ...(style.dash ? { "line-dasharray": style.dash } : {}),
          },
        });
        // Route label
        map.addLayer({
          id: `${srcId}-label`,
          type: "symbol",
          source: srcId,
          layout: {
            "symbol-placement": "line",
            "text-field": r.name,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 10,
            "text-offset": [0, -0.8],
          },
          paint: { "text-color": style.color, "text-halo-color": "rgba(0,0,0,0.7)", "text-halo-width": 1 },
        });
      });

      // Bottleneck markers
      BOTTLENECKS.forEach((b) => {
        const style = BOTTLENECK_STYLES[b.severity];
        const el = document.createElement("div");
        el.style.cssText = `width:${style.size}px;height:${style.size}px;background:${style.color};border:2px solid rgba(255,255,255,0.8);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:${style.size - 4}px;cursor:pointer;box-shadow:0 0 8px ${style.color}80;`;
        el.textContent = BOTTLENECK_ICONS[b.type];
        new mapboxgl.Marker({ element: el })
          .setLngLat([b.longitude, b.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "280px" }).setHTML(
            `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
              <div style="font-weight:700;color:${style.color}">${BOTTLENECK_ICONS[b.type]} ${b.name}</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:2px">${b.severity.toUpperCase()} · +${b.delayMinutes} min delay</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:4px;line-height:1.4">${b.description}</div>
            </div>`
          ))
          .addTo(map);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [hvraAssets]);

  /* ── Toggle evacuation layers visibility ────────────────── */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const visibility = showEvacRoutes ? "visible" : "none";
    EVAC_ROUTES.forEach((r) => {
      const layerId = `evac-route-${r.id}-layer`;
      const labelId = `evac-route-${r.id}-label`;
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
      if (map.getLayer(labelId)) map.setLayoutProperty(labelId, "visibility", visibility);
    });
  }, [showEvacRoutes]);

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
        {/* ── Breadcrumb Navigation ───────────────────────── */}
        <nav className="flex items-center gap-2 text-xs text-white/50 mb-2">
          <button
            onClick={() => navigate("/")}
            className="hover:text-white/80 transition-colors"
          >
            Dashboard
          </button>
          <span className="text-white/30">/</span>
          <span className="text-white/70">Command Center</span>
        </nav>

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
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Operational Map — Fire, Asset & Evacuation Overlay
              </h2>
              <button
                onClick={() => setShowEvacRoutes(!showEvacRoutes)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                  showEvacRoutes
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                    : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
                }`}
              >
                <Route className="w-3 h-3" />
                Evac Routes
              </button>
              <button
                onClick={() => setShowWeather(!showWeather)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                  showWeather
                    ? "bg-sky-500/15 border-sky-500/30 text-sky-300"
                    : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
                }`}
              >
                <Cloud className="w-3 h-3" />
                Weather
              </button>
              <button
                onClick={() => setShowSpreadPrediction(!showSpreadPrediction)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                  showSpreadPrediction
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                    : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
                }`}
              >
                <Flame className="w-3 h-3" />
                Spread
              </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/30 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white/30" /> Substation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-cyan-400 rounded" /> Transmission
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#FB7185" }} /> Hospital
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#FBBF24" }} /> School
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#22D3EE" }} /> Water
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ADE80" }} /> Timber
              </span>
              <span className="text-white/15">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded" style={{ background: "#10B981" }} /> Primary Route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded" style={{ background: "#3B82F6", borderTop: "1px dashed #3B82F6" }} /> Secondary
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border" style={{ background: "#EF444420", borderColor: "#EF4444" }} /> Bottleneck
              </span>
              <span className="text-white/15">|</span>
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

        {/* ── Tabs: Grid Assets / HVRA Registry ─────────────── */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-4">
            <button
              onClick={() => setActiveTab("assets")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "assets" ? "border-blue-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Zap className="w-4 h-4 text-blue-400" />
              Grid Asset Status
            </button>
            <button
              onClick={() => setActiveTab("hvra")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "hvra" ? "border-purple-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <MapPin className="w-4 h-4 text-purple-400" />
              HVRA Registry
            </button>
            <button
              onClick={() => setActiveTab("nvc")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "nvc" ? "border-emerald-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              NVC Risk Scores
            </button>
            <button
              onClick={() => setActiveTab("evac")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "evac" ? "border-amber-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Route className="w-4 h-4 text-amber-400" />
              Evacuation
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "resources" ? "border-red-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Shield className="w-4 h-4 text-red-400" />
              Resources
            </button>
            <button
              onClick={() => setActiveTab("insurance")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "insurance" ? "border-teal-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <DollarSign className="w-4 h-4 text-teal-400" />
              Insurance Risk
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "history" ? "border-orange-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Clock className="w-4 h-4 text-orange-400" />
              Fire History
            </button>
            <button
              onClick={() => setActiveTab("behavior")}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === "behavior" ? "border-rose-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Flame className="w-4 h-4 text-rose-400" />
              Fire Behavior
            </button>
          </div>

          {activeTab === "assets" ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                      <th className="px-5 py-3 font-medium">Asset Name</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Voltage</th>
                      <th className="px-5 py-3 font-medium">Capacity</th>
                      <th className="px-5 py-3 font-medium">Zone</th>
                      <th className="px-5 py-3 font-medium">Nearest Fire</th>
                      <th className="px-5 py-3 font-medium">Risk Level</th>
                      <th className="px-5 py-3 font-medium">Trend</th>
                      <th className="px-5 py-3 font-medium">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {assetRisks.map((a) => {
                      const ssData = SUBSTATIONS.find((s) => s.id === a.id);
                      return (
                        <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 font-medium">{a.name}</td>
                          <td className="px-5 py-3 text-white/50">
                            <span className="inline-flex items-center gap-1">
                              {a.type === "Substation" ? <Zap className="w-3 h-3 text-blue-400" /> : <Minus className="w-3 h-3 text-cyan-400" />}
                              {a.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-white/60 font-mono text-xs">{a.voltage}</td>
                          <td className="px-5 py-3 text-white/60 text-xs">{ssData ? `${ssData.capacityMW} MW` : "—"}</td>
                          <td className="px-5 py-3 text-white/60 text-xs">{ssData?.zone || "—"}</td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2 border-t border-white/[0.04] text-[10px] text-white/20">
                Risk calculated from fire proximity, intensity (FRP), and approach trend
              </div>
            </>
          ) : activeTab === "hvra" ? (
            <div className="p-5">
              <HvraPanel fires={fires} />
            </div>
          ) : activeTab === "nvc" ? (
            <div className="p-5">
              <NvcDashboard fires={fires} hvraAssets={hvraAssets} />
            </div>
          ) : activeTab === "evac" ? (
            <div className="p-5">
              <EvacuationPanel />
            </div>
          ) : activeTab === "resources" ? (
            <div className="p-5">
              <ResourceTracker />
            </div>
          ) : activeTab === "insurance" ? (
            <div className="p-5">
              <InsuranceRiskPanel fires={fires} hvraAssets={hvraAssets} />
            </div>
          ) : activeTab === "history" ? (
            <div className="p-5">
              <FireHistoryTimeline fires={fires} />
            </div>
          ) : (
            <div className="p-5">
              <FireBehaviorPanel fires={fires} weatherData={weatherData} />
            </div>
          )}
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

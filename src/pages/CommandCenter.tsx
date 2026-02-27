import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useCircuitIgnitionRisk, usePsaRisk } from "@/hooks/use-backend-data";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle,
  Activity, Zap, Radio, TrendingUp, TrendingDown, Minus, Layers, ArrowLeft, MapPin, BarChart3, Route, Shield, DollarSign, Cloud, Clock, Flame, Bell, FileText, Users, Server, Volume2, VolumeX, Download, Settings, ChevronDown, Moon, Sun,
} from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useCustomer } from "@/hooks/use-customer";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import HvraPanel, { CATEGORY_CONFIG, type HvraAsset } from "@/components/HvraPanel";
import NvcDashboard from "@/components/NvcDashboard";
import EvacuationPanel from "@/components/EvacuationPanel";
import ResourceTracker from "@/components/ResourceTracker";
import InsuranceRiskPanel from "@/components/InsuranceRiskPanel";
import FireHistoryTimeline from "@/components/FireHistoryTimeline";
import FireBehaviorPanel from "@/components/FireBehaviorPanel";
import CommunityAlertsPanel from "@/components/CommunityAlertsPanel";
import AfterActionReport from "@/components/AfterActionReport";
import ComplianceDashboard from "@/components/ComplianceDashboard";
import VegetationRiskPanel from "@/components/VegetationRiskPanel";
import SmsAlertsPanel from "@/components/SmsAlertsPanel";
import BackendOpsPanel from "@/components/BackendOpsPanel";
import RiskAlertsPanel from "@/components/RiskAlertsPanel";
import CircuitOutagePanel from "@/components/CircuitOutagePanel";
import RiskThresholdSettings from "@/components/RiskThresholdSettings";
import FieldOpsPanel from "@/components/FieldOpsPanel";
import {
  EVAC_ROUTES, BOTTLENECKS, ROUTE_STYLES, BOTTLENECK_STYLES, BOTTLENECK_ICONS,
} from "@/lib/evacuation-data";
import { downloadCsv, formatAssetRiskCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";
import CircuitRiskTrendRow from "@/components/CircuitRiskTrendRow";
import Top5RisingRiskCard from "@/components/Top5RisingRiskCard";
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
  const { setCustomer, setRole, setAgentEmail } = useCustomer();
  const { dark, toggle } = useDarkMode();
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [section, setSection] = useState<"overview" | "operations" | "risk">("overview");
  const [activeTab, setActiveTab] = useState<"assets" | "hvra" | "nvc" | "evac" | "resources" | "insurance" | "history" | "behavior" | "alerts" | "sms" | "after-action" | "compliance" | "vegetation" | "backend" | "risk-alerts" | "outage" | "thresholds" | "field-ops">("assets");
  const [customers, setCustomers] = useState<{ hftd_tier: string; zip_code: string; medical_baseline?: boolean; has_portable_battery?: boolean; has_permanent_battery?: string }[]>([]);
  const [hvraAssets, setHvraAssets] = useState<HvraAsset[]>([]);
  const [assetSort, setAssetSort] = useState<{ col: string; desc: boolean }>({ col: "risk", desc: true });
  const [hftdFilter, setHftdFilter] = useState<string>("All");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [showEvacRoutes, setShowEvacRoutes] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const weatherMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [showSpreadPrediction, setShowSpreadPrediction] = useState(false);
  const spreadMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [showIgnitionHeatmap, setShowIgnitionHeatmap] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const fireHistoryRef = useRef<Map<string, number>>(new Map());
  const [expandedCircuit, setExpandedCircuit] = useState<string | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const handleCircuitSelect = useCallback((circuitId: string | null, staging: { latitude: number; longitude: number; name: string } | null) => {
    // Remove previous highlight
    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.remove();
      highlightMarkerRef.current = null;
    }
    if (!circuitId || !staging || !mapRef.current) return;

    // Fly to staging area
    mapRef.current.flyTo({ center: [staging.longitude, staging.latitude], zoom: 12, duration: 1200 });

    // Add pulsing highlight marker
    const el = document.createElement("div");
    el.className = "circuit-highlight-pulse";
    el.innerHTML = `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(249,115,22,0.3);
      border: 2px solid #f97316;
      animation: pulse-ring 1.5s ease-out infinite;
      display: flex; align-items: center; justify-content: center;
    "><div style="width:10px;height:10px;border-radius:50%;background:#f97316;"></div></div>`;

    highlightMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([staging.longitude, staging.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(
        `<div style="font-size:12px;"><strong>${circuitId}</strong><br/><span style="color:#888;">Staging: ${staging.name}</span></div>`
      ))
      .addTo(mapRef.current)
      .togglePopup();
  }, []);
  // Backend ML predictions
  const circuitRiskQuery = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 500 });
  const psaRiskQuery = usePsaRisk({ limit: 500 });


  // Build lookup maps: circuit_id → prediction data
  const circuitRiskMap = useMemo(() => {
    const map = new Map<string, { prob: number; band: string }>();
    if (circuitRiskQuery.data?.results) {
      for (const r of circuitRiskQuery.data.results) {
        map.set(r.circuit_id, { prob: r.prob_spike, band: r.risk_band });
      }
    }
    return map;
  }, [circuitRiskQuery.data]);

  const psaRiskMap = useMemo(() => {
    const map = new Map<string, { prob: number; bucket: string }>();
    if (psaRiskQuery.data?.results) {
      for (const r of psaRiskQuery.data.results) {
        map.set(r.circuit_id, { prob: r.prob_above_normal, bucket: r.risk_bucket });
      }
    }
    return map;
  }, [psaRiskQuery.data]);

  // Asset name lookup for alerts panel
  const assetNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ss of SUBSTATIONS) map.set(ss.id, ss.name);
    for (const tl of TRANSMISSION_LINES) map.set(tl.id, tl.name);
    return map;
  }, []);

  // Global breach detection → toast notifications + audio alerts
  const globalBreachRef = useRef<Set<string>>(new Set());
  const [riskThreshold] = useState(0.5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlertTone = useCallback((critical: boolean) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Two-tone urgent beep pattern
      const freqs = critical ? [880, 1100, 880] : [660, 880];
      const beepDur = critical ? 0.12 : 0.15;
      const gap = 0.06;

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = critical ? "square" : "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * (beepDur + gap));
        gain.gain.linearRampToValueAtTime(0.15, now + i * (beepDur + gap) + 0.01);
        gain.gain.setValueAtTime(0.15, now + i * (beepDur + gap) + beepDur - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * (beepDur + gap) + beepDur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * (beepDur + gap));
        osc.stop(now + i * (beepDur + gap) + beepDur);
      });
    } catch (_) { /* AudioContext not available */ }
  }, [soundEnabled]);

  useEffect(() => {
    if (circuitRiskMap.size === 0) return;

    const newBreaches: { name: string; prob: number; band: string }[] = [];
    const currentSet = new Set<string>();
    let hasCritical = false;

    circuitRiskMap.forEach(({ prob, band }, circuitId) => {
      if (prob >= riskThreshold) {
        currentSet.add(circuitId);
        if (!globalBreachRef.current.has(circuitId)) {
          newBreaches.push({ name: assetNamesMap.get(circuitId) || circuitId, prob, band });
          if (prob >= 0.75) hasCritical = true;
        }
      }
    });

    globalBreachRef.current = currentSet;

    if (newBreaches.length > 0) {
      // Play sound for critical breaches (≥75%)
      if (hasCritical) playAlertTone(true);
      else playAlertTone(false);

      if (newBreaches.length <= 5) {
        newBreaches.forEach((b) => {
          const isCrit = b.prob >= 0.75;
          (isCrit ? toast.error : toast.warning)(
            `${isCrit ? "🔴" : "⚡"} ${b.name} — ${(b.prob * 100).toFixed(0)}% ignition risk (${b.band})`,
            { duration: isCrit ? 12000 : 8000, description: isCrit ? "CRITICAL: Immediate attention required" : "Circuit risk threshold exceeded" }
          );
        });
      } else {
        toast.warning(`⚡ ${newBreaches.length} circuits exceeded ${(riskThreshold * 100).toFixed(0)}% ignition risk`, {
          duration: 8000,
          description: `Highest: ${newBreaches[0].name} at ${(newBreaches[0].prob * 100).toFixed(0)}%`,
        });
      }
    }
  }, [circuitRiskMap, riskThreshold, assetNamesMap, playAlertTone]);


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

  // Fetch customers for HFTD distribution
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("customers").select("hftd_tier, zip_code, medical_baseline, has_portable_battery, has_permanent_battery");
      if (data) setCustomers(data);
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

  // Ignition risk heatmap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const SOURCE_ID = "ignition-heatmap-src";
    const LAYER_ID = "ignition-heatmap-layer";

    // Remove existing layer/source
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (!showIgnitionHeatmap || circuitRiskMap.size === 0) return;

    // Build GeoJSON from substations + their ignition risk probabilities
    const features: GeoJSON.Feature[] = [];
    for (const ss of SUBSTATIONS) {
      const risk = circuitRiskMap.get(ss.id);
      if (risk) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [ss.longitude, ss.latitude] },
          properties: { prob: risk.prob, band: risk.band, name: ss.name },
        });
      }
    }
    // Also add transmission line midpoints
    for (const tl of TRANSMISSION_LINES) {
      const risk = circuitRiskMap.get(tl.id);
      if (risk && tl.coordinates.length > 0) {
        const mid = tl.coordinates[Math.floor(tl.coordinates.length / 2)];
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: mid },
          properties: { prob: risk.prob, band: risk.band, name: tl.name },
        });
      }
    }

    if (features.length === 0) return;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: LAYER_ID,
      type: "heatmap",
      source: SOURCE_ID,
      paint: {
        "heatmap-weight": ["get", "prob"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 2.5],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 30, 12, 60, 14, 80],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.15, "rgba(253,240,148,0.4)",
          0.35, "rgba(252,186,3,0.55)",
          0.55, "rgba(249,115,22,0.7)",
          0.75, "rgba(220,38,38,0.8)",
          1, "rgba(185,28,28,0.9)",
        ],
        "heatmap-opacity": 0.75,
      },
    });

    // Clickable circle layer on top for inspect
    const CIRCLE_LAYER = "ignition-heatmap-circles";
    map.addLayer({
      id: CIRCLE_LAYER,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 14, 14],
        "circle-color": "transparent",
        "circle-stroke-width": 0,
      },
    });

    map.on("mouseenter", CIRCLE_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", CIRCLE_LAYER, () => { map.getCanvas().style.cursor = ""; });

    map.on("click", CIRCLE_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f || !f.properties) return;
      const { name, prob, band } = f.properties;
      const pct = (prob * 100).toFixed(1);
      const bandColor = band === "Critical" ? "#DC2626" : band === "High" ? "#F97316" : band === "Elevated" ? "#EAB308" : "#34D399";
      const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      new mapboxgl.Popup({ offset: 14, maxWidth: "220px" })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
            <div style="font-weight:700;color:${bandColor}">${name}</div>
            <div style="margin-top:4px;font-size:12px;color:#94a3b8">
              Ignition Probability: <b style="color:${bandColor}">${pct}%</b><br/>
              Risk Band: <b style="color:${bandColor}">${band}</b>
            </div>
          </div>`
        )
        .addTo(map);
    });

    return () => {
      if (map.getLayer(CIRCLE_LAYER)) map.removeLayer(CIRCLE_LAYER);
    };
  }, [showIgnitionHeatmap, circuitRiskMap]);

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

  const HFTD_RANK: Record<string, number> = { "Tier 3": 3, "Tier 2": 2, "Tier 1": 1, "None": 0 };
  const RISK_RANK: Record<string, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 };


  const HFTD_TIER_CONFIG: Record<string, { color: string; label: string }> = {
    "Tier 3": { color: "#DC2626", label: "Tier 3 (Extreme)" },
    "Tier 2": { color: "#F97316", label: "Tier 2 (Elevated)" },
    "Tier 1": { color: "#EAB308", label: "Tier 1 (Moderate)" },
    "None": { color: "#6B7280", label: "No HFTD" },
  };

  const hftdDistribution = useMemo(() => {
    const counts: Record<string, number> = { "Tier 3": 0, "Tier 2": 0, "Tier 1": 0, "None": 0 };
    customers.forEach((c) => {
      const tier = c.hftd_tier in counts ? c.hftd_tier : "None";
      counts[tier]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: HFTD_TIER_CONFIG[name]?.color || "#6B7280" }));
  }, [customers]);

  // Compute highest HFTD tier per substation (reusable across map + table)
  const ssHftdTiers = useMemo(() => {
    const tierRank: Record<string, number> = { "Tier 3": 3, "Tier 2": 2, "Tier 1": 1, "None": 0 };
    const result: Record<string, string> = {};
    SUBSTATIONS.forEach((ss) => {
      let best = "None";
      customers.forEach((c) => {
        if (ss.servesZips.includes(c.zip_code || "")) {
          const t = c.hftd_tier || "None";
          if ((tierRank[t] ?? 0) > (tierRank[best] ?? 0)) best = t;
        }
      });
      result[ss.id] = best;
    });
    return result;
  }, [customers]);

  const sortedAssetRisks = useMemo(() => {
    let filtered = [...assetRisks];
    if (hftdFilter !== "All") {
      filtered = filtered.filter((a) => (ssHftdTiers[a.id] || "None") === hftdFilter);
    }
    if (riskFilter !== "All") {
      filtered = filtered.filter((a) => a.risk === riskFilter);
    }
    const { col, desc } = assetSort;
    filtered.sort((a, b) => {
      let cmp = 0;
      if (col === "hftd") {
        cmp = (HFTD_RANK[ssHftdTiers[a.id] || "None"] || 0) - (HFTD_RANK[ssHftdTiers[b.id] || "None"] || 0);
      } else if (col === "risk") {
        cmp = (RISK_RANK[a.risk] || 0) - (RISK_RANK[b.risk] || 0);
      } else if (col === "fire") {
        const da = a.nearestFireDist >= 0 ? a.nearestFireDist : 9999;
        const db = b.nearestFireDist >= 0 ? b.nearestFireDist : 9999;
        cmp = da - db;
      } else if (col === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (col === "ignition") {
        const ia = circuitRiskMap.get(a.id)?.prob ?? -1;
        const ib = circuitRiskMap.get(b.id)?.prob ?? -1;
        cmp = ia - ib;
      } else if (col === "psa") {
        const pa = psaRiskMap.get(a.id)?.prob ?? -1;
        const pb = psaRiskMap.get(b.id)?.prob ?? -1;
        cmp = pa - pb;
      }
      return desc ? -cmp : cmp;
    });
    return filtered;
  }, [assetRisks, assetSort, ssHftdTiers, hftdFilter, riskFilter, circuitRiskMap, psaRiskMap]);

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

      // Substation markers — color-coded by highest HFTD tier served
      const HFTD_MARKER_COLORS: Record<string, { bg: string; shadow: string; label: string }> = {
        "Tier 3": { bg: "#DC2626", shadow: "rgba(220,38,38,0.5)", label: "HFTD Tier 3" },
        "Tier 2": { bg: "#F97316", shadow: "rgba(249,115,22,0.5)", label: "HFTD Tier 2" },
        "Tier 1": { bg: "#EAB308", shadow: "rgba(234,179,8,0.5)", label: "HFTD Tier 1" },
        "None":   { bg: "#3B82F6", shadow: "rgba(59,130,246,0.5)", label: "No HFTD" },
      };

      SUBSTATIONS.forEach((ss) => {
        const hftd = ssHftdTiers[ss.id] || "None";
        const mc = HFTD_MARKER_COLORS[hftd] || HFTD_MARKER_COLORS["None"];
        const el = document.createElement("div");
        el.style.cssText = `width:14px;height:14px;background:${mc.bg};border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px ${mc.shadow};cursor:pointer;`;
        new mapboxgl.Marker({ element: el })
          .setLngLat([ss.longitude, ss.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: "240px" }).setHTML(
            `<div style="font-family:system-ui;font-size:13px;color:#e2e8f0">
              <div style="font-weight:700;color:${mc.bg}">${ss.name}</div>
              <div style="color:#94a3b8;font-size:12px">${ss.id} · ${ss.voltage}</div>
              <div style="margin-top:4px;font-size:11px;font-weight:600;color:${mc.bg}">${mc.label}</div>
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
      <TopNav variant="dark" />
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
              onClick={() => navigate("/docs")}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
            >
              <FileText className="w-3.5 h-3.5" />
              Docs
            </button>
            <button
              onClick={fetchFires}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors disabled:opacity-30 bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-5 space-y-5">
        {/* ── Top-level Section Tabs ─────────────────────────── */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1">
          {([
            { key: "overview" as const, label: "Overview", icon: Activity },
            { key: "operations" as const, label: "Operations", icon: Shield },
            { key: "risk" as const, label: "Risk & Planning", icon: BarChart3 },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSection(s.key);
                if (s.key === "overview") setActiveTab("assets");
                else if (s.key === "operations") setActiveTab("field-ops");
                else if (s.key === "risk") setActiveTab("vegetation");
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                section === s.key
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>

        {/* ════════════════ OVERVIEW ════════════════ */}
        <div className={section === "overview" ? "" : "hidden"}>
          <div className="space-y-5">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <ExecCard icon={<Activity className="w-5 h-5 text-orange-400" />} label="Active Fires" sublabel="within 50 km of assets" value={loading ? "…" : String(enriched.length)} loading={loading} />
              <ExecCard icon={<Zap className="w-5 h-5 text-blue-400" />} label="Assets at Risk" sublabel="high or critical exposure" value={loading ? "…" : String(assetsAtRisk)} loading={loading} highlight={assetsAtRisk > 0} />
              <ExecCard icon={<AlertTriangle className="w-5 h-5 text-red-400" />} label="Critical Alerts" sublabel="requiring immediate action" value={loading ? "…" : String(criticalCount)} loading={loading} highlight={criticalCount > 0} />
              <div className={`rounded-xl border p-4 flex flex-col justify-between ${gridCfg.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${gridCfg.dot}`} />
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Grid Status</span>
                </div>
                <span className={`text-xl font-bold ${gridCfg.color}`}>{loading ? "…" : gridCfg.label}</span>
              </div>
            </div>

            {/* HFTD Distribution */}
            {customers.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-semibold">Customer HFTD Tier Distribution</h2>
                  <span className="text-[10px] text-white/30 ml-2">{customers.length} customers</span>
                </div>
                <div className="flex items-center gap-8">
                  <div style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={hftdDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={2} stroke="hsl(220,25%,9%)">
                          {hftdDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }} formatter={(value: number, name: string) => [`${value} customers`, HFTD_TIER_CONFIG[name]?.label || name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2">
                    {hftdDistribution.map((d) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-white/60 w-28">{HFTD_TIER_CONFIG[d.name]?.label || d.name}</span>
                        <span className="text-sm font-bold">{d.value}</span>
                        <span className="text-[10px] text-white/30">({customers.length > 0 ? Math.round((d.value / customers.length) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top 5 Rising Risk */}
            <Top5RisingRiskCard onCircuitClick={(circuitId, staging) => handleCircuitSelect(circuitId, staging)} />

            {/* Interactive Map */}
            <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" /> Operational Map
                  </h2>
                  <button onClick={() => setShowEvacRoutes(!showEvacRoutes)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${showEvacRoutes ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"}`}>
                    <Route className="w-3 h-3" /> Evac
                  </button>
                  <button onClick={() => setShowWeather(!showWeather)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${showWeather ? "bg-sky-500/15 border-sky-500/30 text-sky-300" : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"}`}>
                    <Cloud className="w-3 h-3" /> Weather
                  </button>
                  <button onClick={() => setShowSpreadPrediction(!showSpreadPrediction)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${showSpreadPrediction ? "bg-rose-500/15 border-rose-500/30 text-rose-300" : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"}`}>
                    <Flame className="w-3 h-3" /> Spread
                  </button>
                  <button onClick={() => setShowIgnitionHeatmap(!showIgnitionHeatmap)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${showIgnitionHeatmap ? "bg-orange-500/15 border-orange-500/30 text-orange-300" : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"}`}>
                    <Activity className="w-3 h-3" /> Ignition
                  </button>
                  <button onClick={() => setSoundEnabled(!soundEnabled)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${soundEnabled ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"}`}>
                    {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />} Sound
                  </button>
                </div>
              </div>
              <div style={{ height: 480 }} className="relative w-full">
                <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
                {loading && (
                  <div className="absolute inset-0 z-[1000] bg-black/50 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-white/50" />
                  </div>
                )}
                {showIgnitionHeatmap && (
                  <div className="absolute bottom-3 left-3 z-[900] rounded-lg border border-white/10 bg-black/80 backdrop-blur-sm px-3 py-2.5 text-[10px] font-medium text-white/70">
                    <div className="mb-1.5 text-[11px] font-semibold text-orange-300 flex items-center gap-1"><Activity className="w-3 h-3" /> Ignition Risk 24h</div>
                    <div className="flex items-center gap-1.5">
                      <span>Low</span>
                      <div className="h-2.5 w-32 rounded-sm" style={{ background: "linear-gradient(to right, rgba(253,240,148,0.6), rgba(252,186,3,0.7), rgba(249,115,22,0.85), rgba(220,38,38,0.9), rgba(185,28,28,1))" }} />
                      <span>Critical</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Grid Assets / Risk Alerts / Outage — sub-tabs */}
            <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-4">
                <button onClick={() => setActiveTab("assets")} className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === "assets" ? "border-blue-400 text-white" : "border-transparent text-white/40 hover:text-white/60"}`}>
                  <Zap className="w-4 h-4 text-blue-400" /> Grid Assets
                </button>
                <button onClick={() => setActiveTab("risk-alerts")} className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === "risk-alerts" ? "border-orange-400 text-white" : "border-transparent text-white/40 hover:text-white/60"}`}>
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Risk Alerts
                </button>
                <button onClick={() => setActiveTab("outage")} className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === "outage" ? "border-violet-400 text-white" : "border-transparent text-white/40 hover:text-white/60"}`}>
                  <Zap className="w-4 h-4 text-violet-400" /> Outage Impact
                </button>
              </div>
              {activeTab === "assets" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-white/[0.06]">
                    {sortedAssetRisks.length > 0 && (
                      <button onClick={() => downloadCsv(formatAssetRiskCsv(sortedAssetRisks), `grid-asset-risk-rankings.csv`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors ml-auto order-last">
                        <Download className="w-3 h-3" /> Export CSV
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-white/30 font-medium">HFTD:</span>
                      {["All", "Tier 3", "Tier 2", "Tier 1", "None"].map((tier) => {
                        const isActive = hftdFilter === tier;
                        const dotColor = tier === "All" ? undefined : HFTD_TIER_CONFIG[tier]?.color;
                        return (
                          <button key={tier} onClick={() => setHftdFilter(tier)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${isActive ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"}`}>
                            {dotColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />}
                            {tier === "All" ? "All" : tier}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-white/10">|</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-white/30 font-medium">Risk:</span>
                      {(["All", "Critical", "High", "Medium", "Low"] as string[]).map((level) => {
                        const isActive = riskFilter === level;
                        const dotColor = level === "All" ? undefined : RISK_COLORS[level as RiskLevel];
                        return (
                          <button key={level} onClick={() => setRiskFilter(level)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${isActive ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"}`}>
                            {dotColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />}
                            {level}
                          </button>
                        );
                      })}
                    </div>
                    {(hftdFilter !== "All" || riskFilter !== "All") && (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[10px] text-white/30">{sortedAssetRisks.length} of {assetRisks.length} assets</span>
                        <button onClick={() => { setHftdFilter("All"); setRiskFilter("All"); }} className="text-[10px] text-white/40 hover:text-white/70 underline transition-colors">Clear filters</button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                          {([
                            { key: "name", label: "Asset" }, { key: "", label: "Type" }, { key: "", label: "kV" },
                            { key: "", label: "Cap" }, { key: "", label: "Zone" }, { key: "hftd", label: "HFTD" },
                            { key: "fire", label: "Fire Dist" }, { key: "risk", label: "Risk" },
                            { key: "ignition", label: "Ign 24h" }, { key: "psa", label: "PSA" },
                            { key: "", label: "Trend" }, { key: "", label: "Action" },
                          ] as { key: string; label: string }[]).map((h) => (
                            <th key={h.label} className={`px-4 py-3 font-medium ${h.key ? "cursor-pointer hover:text-white/60 select-none" : ""}`} onClick={h.key ? () => setAssetSort((prev) => ({ col: h.key, desc: prev.col === h.key ? !prev.desc : true })) : undefined}>
                              <span className="inline-flex items-center gap-1">{h.label}{h.key && assetSort.col === h.key && <span className="text-white/50">{assetSort.desc ? "▼" : "▲"}</span>}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {sortedAssetRisks.map((a) => {
                          const ssData = SUBSTATIONS.find((s) => s.id === a.id);
                          const isExpanded = expandedCircuit === a.id;
                          return (
                            <React.Fragment key={a.id}>
                              <tr
                                key={a.id}
                                onClick={() => setExpandedCircuit(isExpanded ? null : a.id)}
                                className={`transition-colors cursor-pointer ${(circuitRiskMap.get(a.id)?.prob ?? 0) > 0.5 ? "bg-red-500/10 hover:bg-red-500/15 border-l-2 border-l-red-500" : "hover:bg-white/[0.02]"}`}
                              >
                              <td className="px-4 py-3 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  {a.name}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-white/50"><span className="inline-flex items-center gap-1">{a.type === "Substation" ? <Zap className="w-3 h-3 text-blue-400" /> : <Minus className="w-3 h-3 text-cyan-400" />}{a.type}</span></td>
                              <td className="px-4 py-3 text-white/60 font-mono text-xs">{a.voltage}</td>
                              <td className="px-4 py-3 text-white/60 text-xs">{ssData ? `${ssData.capacityMW} MW` : "—"}</td>
                              <td className="px-4 py-3 text-white/60 text-xs">{ssData?.zone || "—"}</td>
                              <td className="px-4 py-3">{(() => { const tier = ssHftdTiers[a.id] || "None"; const color = HFTD_TIER_CONFIG[tier]?.color || "#6B7280"; return (<span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{tier}</span>); })()}</td>
                              <td className="px-4 py-3">{a.nearestFireDist >= 0 ? `${a.nearestFireDistMi} mi` : "—"}</td>
                              <td className="px-4 py-3"><RiskBadge risk={a.risk} /></td>
                              <td className="px-4 py-3">{(() => { const cr = circuitRiskMap.get(a.id); if (!cr) return <span className="text-white/20 text-xs">—</span>; const pct = (cr.prob * 100).toFixed(1); const color = cr.band === "CRITICAL" ? "bg-red-500/20 text-red-300" : cr.band === "HIGH" ? "bg-orange-500/15 text-orange-300" : cr.band === "ELEVATED" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"; return (<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{pct}%</span>); })()}</td>
                              <td className="px-4 py-3">{(() => { const pr = psaRiskMap.get(a.id); if (!pr) return <span className="text-white/20 text-xs">—</span>; const pct = (pr.prob * 100).toFixed(0); const color = pr.bucket === "CRITICAL" ? "text-red-400" : pr.bucket === "HIGH" ? "text-orange-400" : pr.bucket === "ELEVATED" ? "text-amber-400" : "text-emerald-400"; return (<span className={`text-xs font-bold ${color}`}>{pct}%</span>); })()}</td>
                              <td className="px-4 py-3"><TrendBadge trend={a.trend} /></td>
                              <td className="px-4 py-3"><ActionBadge action={a.action} /></td>
                              </tr>
                              {isExpanded && (
                                <CircuitRiskTrendRow
                                  key={`trend-${a.id}`}
                                  circuitId={a.id}
                                  onClose={() => setExpandedCircuit(null)}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : activeTab === "risk-alerts" ? (
                <div className="p-5"><RiskAlertsPanel circuitRiskMap={circuitRiskMap} assetNames={assetNamesMap} /></div>
              ) : activeTab === "outage" ? (
                <div className="p-5"><CircuitOutagePanel circuitRiskMap={circuitRiskMap} psaRiskMap={psaRiskMap} customers={customers} /></div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ════════════════ OPERATIONS ════════════════ */}
        {section === "operations" && (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">Operations Center</h2>
                <p className="text-[11px] text-white/40">Tactical coordination, field ops, resources & community alerts</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1 overflow-x-auto">
              {([
                { key: "field-ops" as const, label: "Field Ops", icon: MapPin },
                { key: "resources" as const, label: "Resources", icon: Users },
                { key: "evac" as const, label: "Evacuation", icon: Route },
                { key: "alerts" as const, label: "Community Alerts", icon: Bell },
                { key: "sms" as const, label: "SMS Alerts", icon: Activity },
                { key: "after-action" as const, label: "After Action", icon: FileText },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === t.key
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Active Panel */}
            <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
              {activeTab === "field-ops" && <FieldOpsPanel fires={enriched} weatherData={weatherData?.[0] || null} onCircuitSelect={handleCircuitSelect} />}
              {activeTab === "resources" && <ResourceTracker />}
              {activeTab === "evac" && <EvacuationPanel />}
              {activeTab === "alerts" && <CommunityAlertsPanel fires={fires} />}
              {activeTab === "sms" && <SmsAlertsPanel />}
              {activeTab === "after-action" && <AfterActionReport />}
            </div>
          </div>
        )}

        {/* ════════════════ RISK & PLANNING ════════════════ */}
        {section === "risk" && (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">Risk & Planning</h2>
                <p className="text-[11px] text-white/40">Strategic analysis, compliance, modeling & system operations</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1 overflow-x-auto">
              {([
                { key: "vegetation" as const, label: "Vegetation", icon: Layers },
                { key: "insurance" as const, label: "Insurance", icon: DollarSign },
                { key: "nvc" as const, label: "NVC Analysis", icon: BarChart3 },
                { key: "behavior" as const, label: "Fire Behavior", icon: Flame },
                { key: "history" as const, label: "Fire History", icon: Clock },
                { key: "hvra" as const, label: "HVRA", icon: MapPin },
                { key: "compliance" as const, label: "Compliance", icon: Shield },
                { key: "thresholds" as const, label: "Thresholds", icon: Settings },
                { key: "backend" as const, label: "System Ops", icon: Server },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === t.key
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Active Panel */}
            <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
              {activeTab === "vegetation" && <VegetationRiskPanel />}
              {activeTab === "insurance" && <InsuranceRiskPanel fires={fires} hvraAssets={hvraAssets} />}
              {activeTab === "nvc" && <NvcDashboard fires={fires} hvraAssets={hvraAssets} />}
              {activeTab === "behavior" && <FireBehaviorPanel fires={fires} weatherData={weatherData} />}
              {activeTab === "history" && <FireHistoryTimeline fires={fires} />}
              {activeTab === "hvra" && <HvraPanel fires={fires} />}
              {activeTab === "compliance" && <ComplianceDashboard />}
              {activeTab === "thresholds" && <RiskThresholdSettings />}
              {activeTab === "backend" && <BackendOpsPanel />}
            </div>
          </div>
        )}
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

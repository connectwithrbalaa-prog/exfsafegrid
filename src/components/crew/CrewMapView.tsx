import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { initMapbox, MAPBOX_STYLES } from "@/lib/mapbox-config";
import { supabase } from "@/integrations/supabase/client";
import { Wind, Droplets, Flame, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface GpsPos { lat: number; lng: number; accuracy: number }

interface Props {
  gps: GpsPos | null;
  patrolId: string;
}

interface WeatherData {
  wind_speed_mph: number;
  wind_direction_deg: number;
  humidity_pct: number;
  temperature_f: number;
  label: string;
}

interface IncidentData {
  name: string;
  latitude: number;
  longitude: number;
  acres: number | null;
}

const LAYER_OPTIONS = ["Route", "Hazards", "Fire", "Assets"] as const;
type LayerKey = typeof LAYER_OPTIONS[number];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function windDirLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function deriveRiskBand(humidity: number, wind: number, nearestKm: number | null): string {
  let score = 0;
  if (humidity < 15) score += 3;
  else if (humidity < 20) score += 2;
  else if (humidity < 30) score += 1;
  if (wind > 35) score += 3;
  else if (wind > 25) score += 2;
  else if (wind > 15) score += 1;
  if (nearestKm !== null) {
    if (nearestKm < 5) score += 3;
    else if (nearestKm < 15) score += 2;
    else if (nearestKm < 30) score += 1;
  }
  if (score >= 6) return "CRITICAL";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export default function CrewMapView({ gps, patrolId }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const gpsMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    Route: true, Hazards: true, Fire: true, Assets: false,
  });

  // Live data states
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [nearestIncidentKm, setNearestIncidentKm] = useState<number | null>(null);
  const [nearestIncidentName, setNearestIncidentName] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Fetch weather from edge function
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("weather");
        if (error) throw error;
        const points = data?.weather;
        if (!points || points.length === 0) return;

        // Find nearest weather station to GPS or patrol center
        const refLat = gps?.lat ?? 37.38;
        const refLon = gps?.lng ?? -122.08;
        let nearest = points[0];
        let minDist = Infinity;
        for (const p of points) {
          const d = haversineKm(refLat, refLon, p.latitude, p.longitude);
          if (d < minDist) { minDist = d; nearest = p; }
        }
        setWeather({
          wind_speed_mph: nearest.wind_speed_mph,
          wind_direction_deg: nearest.wind_direction_deg,
          humidity_pct: nearest.humidity_pct,
          temperature_f: nearest.temperature_f,
          label: nearest.label,
        });
      } catch (err) {
        console.error("Weather fetch failed:", err);
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60_000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [gps?.lat, gps?.lng]);

  // Fetch active incidents from backend proxy
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("backend-proxy", {
          body: undefined,
          headers: { "x-target-path": "/incidents/active?limit=50" },
        });
        // Try parsing response
        const list = data?.incidents || data?.data || data || [];
        if (Array.isArray(list)) {
          const mapped: IncidentData[] = list
            .filter((i: any) => i.latitude && i.longitude)
            .map((i: any) => ({
              name: i.incident_name || i.name || "Unknown",
              latitude: Number(i.latitude),
              longitude: Number(i.longitude),
              acres: i.acres || i.daily_acres || null,
            }));
          setIncidents(mapped);
        }
      } catch (err) {
        console.error("Incidents fetch failed:", err);
      }
    };
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 3 * 60_000);
    return () => clearInterval(interval);
  }, []);

  // Compute nearest incident distance when GPS or incidents change
  useEffect(() => {
    if (!gps || incidents.length === 0) {
      setNearestIncidentKm(null);
      setNearestIncidentName(null);
      return;
    }
    let minDist = Infinity;
    let minName = "";
    for (const inc of incidents) {
      const d = haversineKm(gps.lat, gps.lng, inc.latitude, inc.longitude);
      if (d < minDist) { minDist = d; minName = inc.name; }
    }
    setNearestIncidentKm(minDist);
    setNearestIncidentName(minName);
  }, [gps, incidents]);

  // Add incident markers to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || incidents.length === 0) return;
    const tryAdd = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getSource("active-incidents")) {
        (map.getSource("active-incidents") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: incidents.map((i) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [i.longitude, i.latitude] },
            properties: { name: i.name, acres: i.acres },
          })),
        });
        return;
      }
      map.addSource("active-incidents", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: incidents.map((i) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [i.longitude, i.latitude] },
            properties: { name: i.name, acres: i.acres },
          })),
        },
      });
      map.addLayer({
        id: "incidents-layer",
        type: "circle",
        source: "active-incidents",
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "incidents-pulse",
        type: "circle",
        source: "active-incidents",
        paint: { "circle-radius": 14, "circle-color": "#ef4444", "circle-opacity": 0.2 },
      });
      map.on("click", "incidents-layer", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates;
        const dist = gps ? haversineKm(gps.lat, gps.lng, coords[1], coords[0]).toFixed(1) : "?";
        new mapboxgl.Popup({ closeButton: false, maxWidth: "220px" })
          .setLngLat(coords)
          .setHTML(`<div style="color:#000;font-size:12px;"><strong>🔥 ${f.properties?.name}</strong><br/>${f.properties?.acres ? f.properties.acres + " acres" : ""}<br/>${dist} km away</div>`)
          .addTo(map);
      });
    };
    if (map.isStyleLoaded()) tryAdd();
    else map.on("load", tryAdd);
  }, [incidents, gps]);

  // Init map — center on California patrol area
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    initMapbox();
    // Default to patrol task area in California
    const defaultCenter: [number, number] = [-122.08, 37.385];
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLES.satellite,
      center: gps ? [gps.lng, gps.lat] : defaultCenter,
      zoom: 15,
      attributionControl: false,
      projection: "mercator" as any, // Prevent globe view
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      // Fly to patrol area immediately in case initial center was off
      if (!gps) {
        map.flyTo({ center: defaultCenter, zoom: 15, duration: 500 });
      }
      loadPatrolRoute(map);
      loadHvraAssets(map);
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update GPS marker
  useEffect(() => {
    if (!mapRef.current || !gps) return;
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLngLat([gps.lng, gps.lat]);
    } else {
      const el = document.createElement("div");
      el.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:rgba(59,130,246,0.9);border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>`;
      gpsMarkerRef.current = new mapboxgl.Marker(el).setLngLat([gps.lng, gps.lat]).addTo(mapRef.current);
    }
  }, [gps]);

  // Load patrol route from tasks
  const loadPatrolRoute = async (map: mapboxgl.Map) => {
    const { data } = await supabase
      .from("patrol_tasks")
      .select("lat, lon, title, priority")
      .eq("patrol_id", patrolId)
      .order("priority", { ascending: true });
    if (!data || data.length === 0) return;
    const coords = (data as any[]).filter((t) => t.lat && t.lon).map((t) => [Number(t.lon), Number(t.lat)] as [number, number]);
    if (coords.length === 0) return;
    map.addSource("patrol-route", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
    });
    map.addLayer({
      id: "patrol-route-line", type: "line", source: "patrol-route",
      paint: { "line-color": "#f97316", "line-width": 3, "line-dasharray": [2, 2] },
    });
    const features = (data as any[]).filter((t) => t.lat && t.lon).map((t) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(t.lon), Number(t.lat)] },
      properties: { title: t.title, priority: t.priority },
    }));
    map.addSource("patrol-tasks", { type: "geojson", data: { type: "FeatureCollection", features } });
    map.addLayer({
      id: "patrol-tasks-circles", type: "circle", source: "patrol-tasks",
      paint: {
        "circle-radius": 7,
        "circle-color": ["match", ["get", "priority"], 1, "#ef4444", 2, "#f97316", 3, "#eab308", "#3b82f6"],
        "circle-stroke-width": 2, "circle-stroke-color": "#ffffff",
      },
    });
    map.on("click", "patrol-tasks-circles", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      new mapboxgl.Popup({ closeButton: false, maxWidth: "200px" })
        .setLngLat((f.geometry as any).coordinates)
        .setHTML(`<div style="color:#000;font-size:12px;"><strong>P${f.properties?.priority}</strong> ${f.properties?.title}</div>`)
        .addTo(map);
    });
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    if (gps) bounds.extend([gps.lng, gps.lat]);
    map.fitBounds(bounds, { padding: 60 });
  };

  // Load HVRA assets
  const loadHvraAssets = async (map: mapboxgl.Map) => {
    const { data } = await supabase.from("hvra_assets").select("*").limit(100);
    if (!data || data.length === 0) return;
    const features = data.map((a: any) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [a.longitude, a.latitude] },
      properties: { name: a.name, category: a.category },
    }));
    map.addSource("hvra-assets", { type: "geojson", data: { type: "FeatureCollection", features } });
    map.addLayer({
      id: "hvra-assets-layer", type: "circle", source: "hvra-assets",
      paint: { "circle-radius": 5, "circle-color": "#a855f7", "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
      layout: { visibility: "none" },
    });
  };

  // Toggle layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    setVis("patrol-route-line", layers.Route);
    setVis("patrol-tasks-circles", layers.Route);
    setVis("hvra-assets-layer", layers.Assets);
    setVis("incidents-layer", layers.Fire);
    setVis("incidents-pulse", layers.Fire);
  }, [layers]);

  const toggleLayer = (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  // Derive risk band from live data
  const riskBand = weather
    ? deriveRiskBand(weather.humidity_pct, weather.wind_speed_mph, nearestIncidentKm)
    : "LOW";
  const riskColor = riskBand === "CRITICAL" ? "bg-red-600" : riskBand === "HIGH" ? "bg-orange-500" : riskBand === "MEDIUM" ? "bg-yellow-500" : "bg-emerald-500";
  const humidityAlert = weather && weather.humidity_pct < 20;

  // Track previous risk band and alert on escalation
  const prevRiskRef = useRef<string>("LOW");

  useEffect(() => {
    const prev = prevRiskRef.current;
    const elevated = riskBand === "CRITICAL" || riskBand === "HIGH";
    const wasElevated = prev === "CRITICAL" || prev === "HIGH";
    const escalated = elevated && !wasElevated;
    const wentCritical = riskBand === "CRITICAL" && prev !== "CRITICAL";

    if (escalated || wentCritical) {
      // In-app toast alert
      const isCritical = riskBand === "CRITICAL";
      toast.error(
        isCritical
          ? "🚨 CRITICAL FIRE RISK — Seek safety immediately"
          : "⚠️ HIGH FIRE RISK — Heightened awareness required",
        {
          description: weather
            ? `Wind ${Math.round(weather.wind_speed_mph)} mph, Humidity ${Math.round(weather.humidity_pct)}%${nearestIncidentKm !== null ? `, Fire ${nearestIncidentKm.toFixed(1)} km` : ""}`
            : undefined,
          duration: isCritical ? 15000 : 8000,
        }
      );

      // Browser push notification (if permission granted)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(
          isCritical ? "🚨 CRITICAL FIRE RISK" : "⚠️ HIGH FIRE RISK",
          {
            body: isCritical
              ? "Conditions are critical. Seek safety and contact dispatch."
              : "Fire risk has escalated. Stay alert and follow protocols.",
            icon: "/favicon.ico",
            tag: "risk-alert",
            requireInteraction: isCritical,
          }
        );
      }

      // Vibrate on mobile if available
      if (navigator.vibrate) {
        navigator.vibrate(isCritical ? [300, 100, 300, 100, 300] : [200, 100, 200]);
      }
    }

    prevRiskRef.current = riskBand;
  }, [riskBand, weather, nearestIncidentKm]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="relative h-[calc(100vh-140px)]">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Layer toggles */}
      <div className="absolute top-16 right-3 z-10 flex flex-col gap-1.5">
        {LAYER_OPTIONS.map((key) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all shadow-lg ${
              layers[key]
                ? "bg-orange-500 text-white"
                : "bg-gray-900/80 text-white/50 border border-white/10"
            }`}
          >{key}</button>
        ))}
      </div>

      {/* Safety strip - live data */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gray-950/95 backdrop-blur-sm border-t border-white/10">
        {/* Risk band bar */}
        <div className={`h-1 ${riskColor} w-full`} />

        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Risk label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`${riskColor} w-2.5 h-2.5 rounded-full`} />
              <span className="text-[11px] font-bold text-white">{riskBand}</span>
            </div>

            {/* Weather readings */}
            {weather ? (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-white/50">
                  <Wind className="w-3 h-3" />
                  {Math.round(weather.wind_speed_mph)} mph {windDirLabel(weather.wind_direction_deg)}
                </span>
                <span className={`flex items-center gap-1 ${humidityAlert ? "text-red-400 font-semibold" : "text-white/50"}`}>
                  <Droplets className="w-3 h-3" />
                  {Math.round(weather.humidity_pct)}%
                  {humidityAlert && <AlertTriangle className="w-2.5 h-2.5" />}
                </span>
                <span className="text-white/30">{Math.round(weather.temperature_f)}°F</span>
              </div>
            ) : (
              <span className="text-[10px] text-white/20">
                {weatherLoading ? "Loading weather…" : "Weather unavailable"}
              </span>
            )}

            {/* Nearest incident */}
            {nearestIncidentKm !== null && (
              <span className="flex items-center gap-1 text-[11px] text-orange-400 shrink-0">
                <Flame className="w-3 h-3" />
                {nearestIncidentKm < 100 ? nearestIncidentKm.toFixed(1) : Math.round(nearestIncidentKm)} km
              </span>
            )}
          </div>

          {/* Station label + incident name */}
          <div className="flex items-center justify-between mt-1">
            {weather && (
              <span className="text-[9px] text-white/20">Station: {weather.label}</span>
            )}
            {nearestIncidentName && (
              <span className="text-[9px] text-white/20 truncate ml-2">Nearest: {nearestIncidentName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

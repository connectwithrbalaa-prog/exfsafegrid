import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { initMapbox, MAPBOX_TOKEN, MAPBOX_STYLES } from "@/lib/mapbox-config";
import { supabase } from "@/integrations/supabase/client";

interface GpsPos { lat: number; lng: number; accuracy: number }

interface Props {
  gps: GpsPos | null;
  patrolId: string;
}

const LAYER_OPTIONS = ["Route", "Hazards", "Fire", "Assets"] as const;
type LayerKey = typeof LAYER_OPTIONS[number];

export default function CrewMapView({ gps, patrolId }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const gpsMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    Route: true, Hazards: true, Fire: true, Assets: false,
  });
  const [riskBand, setRiskBand] = useState<string>("LOW");
  const [nearestIncidentKm, setNearestIncidentKm] = useState<number | null>(null);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    initMapbox();
    const center: [number, number] = gps ? [gps.lng, gps.lat] : [-122.08, 37.38];
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLES.satellite,
      center,
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Load data after map ready
    map.on("load", () => {
      loadPatrolRoute(map);
      loadHazards(map);
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
      el.className = "crew-gps-dot";
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

    // Route line
    map.addSource("patrol-route", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
    });
    map.addLayer({
      id: "patrol-route-line",
      type: "line",
      source: "patrol-route",
      paint: { "line-color": "#f97316", "line-width": 3, "line-dasharray": [2, 2] },
    });

    // Task markers
    const features = (data as any[]).filter((t) => t.lat && t.lon).map((t) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(t.lon), Number(t.lat)] },
      properties: { title: t.title, priority: t.priority },
    }));
    map.addSource("patrol-tasks", { type: "geojson", data: { type: "FeatureCollection", features } });
    map.addLayer({
      id: "patrol-tasks-circles",
      type: "circle",
      source: "patrol-tasks",
      paint: {
        "circle-radius": 7,
        "circle-color": ["match", ["get", "priority"], 1, "#ef4444", 2, "#f97316", 3, "#eab308", "#3b82f6"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Popup on click
    map.on("click", "patrol-tasks-circles", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      new mapboxgl.Popup({ closeButton: false, maxWidth: "200px" })
        .setLngLat((f.geometry as any).coordinates)
        .setHTML(`<div style="color:#000;font-size:12px;"><strong>P${f.properties?.priority}</strong> ${f.properties?.title}</div>`)
        .addTo(map);
    });

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    if (gps) bounds.extend([gps.lng, gps.lat]);
    map.fitBounds(bounds, { padding: 60 });
  };

  // Load hazard markers
  const loadHazards = async (map: mapboxgl.Map) => {
    const { data } = await supabase.from("hazard_reports").select("id, hazard_type, description, created_at").limit(50);
    // Hazard reports don't have lat/lon in current schema, so skip map markers for now
    // They'll show in the Reports tab
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
      id: "hvra-assets-layer",
      type: "circle",
      source: "hvra-assets",
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
  }, [layers]);

  const toggleLayer = (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const riskColor = riskBand === "CRITICAL" ? "bg-red-600" : riskBand === "HIGH" ? "bg-orange-500" : riskBand === "MEDIUM" ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="relative h-[calc(100vh-140px)]">
      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Layer toggles - top right */}
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
          >
            {key}
          </button>
        ))}
      </div>

      {/* Safety strip - bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gray-950/90 backdrop-blur-sm border-t border-white/10 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`${riskColor} w-3 h-3 rounded-full`} />
            <span className="text-xs font-semibold text-white">{riskBand}</span>
            <span className="text-[10px] text-white/30">Fire Risk</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            <span>Wind: 12 mph NW</span>
            <span>Humidity: 28%</span>
          </div>
          {nearestIncidentKm !== null && (
            <span className="text-[11px] text-orange-400">{nearestIncidentKm.toFixed(1)} km to fire</span>
          )}
        </div>
      </div>
    </div>
  );
}

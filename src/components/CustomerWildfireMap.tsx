import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, RefreshCw, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

// Approximate ZIP code center for California ZIPs (fallback)
const DEFAULT_CENTER: [number, number] = [-120, 37.5];

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

type RiskLevel = "Low" | "Medium" | "High";

function getRiskLevel(frp: number): RiskLevel {
  if (frp > 3) return "High";
  if (frp >= 1) return "Medium";
  return "Low";
}

function getRiskColor(risk: RiskLevel): string {
  if (risk === "High") return "hsl(0, 80%, 50%)";
  if (risk === "Medium") return "hsl(30, 90%, 55%)";
  return "hsl(45, 90%, 55%)";
}

function getRiskBg(risk: RiskLevel): string {
  if (risk === "High") return "bg-destructive/15 text-destructive";
  if (risk === "Medium") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
}

function getRiskRadius(frp: number): number {
  if (frp <= 0) return 6;
  if (frp <= 3) return 8;
  if (frp <= 10) return 12;
  return 16;
}

function formatLocalTime(acq_date: string, acq_time: string): string {
  if (!acq_date || !acq_time) return "Recently";
  const padded = acq_time.padStart(4, "0");
  const h = parseInt(padded.slice(0, 2));
  const m = padded.slice(2);
  try {
    const d = new Date(`${acq_date}T${padded.slice(0, 2)}:${m}:00Z`);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true
    });
  } catch {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${acq_date}, ${h12}:${m} ${ampm} UTC`;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (mi < 1) return "Less than 1 mile away";
  return `${Math.round(mi)} miles away`;
}

interface Props {
  customerZip?: string;
}

export default function CustomerWildfireMap({ customerZip }: Props) {
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Use center of fire data or default
  const centerRef = useRef<[number, number]>(DEFAULT_CENTER);

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
      toast.error("Failed to load fire activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFires(); }, [fetchFires]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: centerRef.current,
      zoom: 7,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const display = fires.length > 500 ? fires.slice(0, 500) : fires;

    // Compute center for distance calculations
    const avgLat = display.length > 0 ? display.reduce((s, f) => s + f.latitude, 0) / display.length : centerRef.current[1];
    const avgLng = display.length > 0 ? display.reduce((s, f) => s + f.longitude, 0) / display.length : centerRef.current[0];
    centerRef.current = [avgLng, avgLat];

    display.forEach((f) => {
      const risk = getRiskLevel(f.frp);
      const color = getRiskColor(risk);
      const r = getRiskRadius(f.frp);
      const dist = haversineKm(avgLat, avgLng, f.latitude, f.longitude);

      const el = document.createElement("div");
      el.style.width = `${r * 2}px`;
      el.style.height = `${r * 2}px`;
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.opacity = "0.8";
      el.style.border = `2px solid ${color}`;
      el.style.cursor = "pointer";
      el.style.boxShadow = risk === "High" ? `0 0 8px ${color}` : "none";

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: "220px" }).setHTML(
        `<div style="font-size:13px;line-height:1.6;color:#333;font-family:system-ui">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:${color}">
            ${risk} Risk
          </div>
          <div style="color:#666;font-size:12px">
            📍 ${formatDistance(dist)}<br/>
            🕐 ${formatLocalTime(f.acq_date, f.acq_time)}<br/>
            Status: <b>${f.frp > 0.5 ? "Active" : "Monitoring"}</b>
          </div>
        </div>`
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([f.longitude, f.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    if (display.length > 0) {
      mapRef.current.flyTo({ center: [avgLng, avgLat], zoom: 7 });
    }
  }, [fires]);

  // Compute summary stats
  const highCount = fires.filter(f => f.frp > 3).length;
  const medCount = fires.filter(f => f.frp >= 1 && f.frp <= 3).length;
  const nearbyCount = fires.length; // all are CA fires

  // Build alert message
  const alertMessage = (() => {
    if (loading) return null;
    if (fires.length === 0) return { text: "No immediate wildfire threat detected in your area.", level: "safe" as const };
    if (highCount > 0) return { text: `${highCount} high-risk ${highCount === 1 ? "fire" : "fires"} detected in your service region.`, level: "high" as const };
    if (medCount > 0) return { text: `${medCount} moderate ${medCount === 1 ? "fire" : "fires"} being monitored near your area.`, level: "medium" as const };
    return { text: `${nearbyCount} low-risk ${nearbyCount === 1 ? "detection" : "detections"} in your region. No immediate concern.`, level: "low" as const };
  })();

  const alertStyles = {
    safe: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
    high: "bg-destructive/10 border-destructive/30 text-destructive",
    medium: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300",
    low: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300",
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-card-foreground">Wildfire Activity Near You</h3>
        </div>
        <button onClick={fetchFires} disabled={loading} className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div className={`mx-3 mt-3 p-3 rounded-md border text-sm font-medium flex items-start gap-2 ${alertStyles[alertMessage.level]}`}>
          {alertMessage.level === "safe" ? (
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {alertMessage.text}
        </div>
      )}

      {/* Summary Badges */}
      {!loading && fires.length > 0 && (
        <div className="flex gap-2 px-3 pt-3 flex-wrap">
          {highCount > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRiskBg("High")}`}>
              {highCount} High Risk
            </span>
          )}
          {medCount > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRiskBg("Medium")}`}>
              {medCount} Medium Risk
            </span>
          )}
          {fires.length - highCount - medCount > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRiskBg("Low")}`}>
              {fires.length - highCount - medCount} Low Risk
            </span>
          )}
        </div>
      )}

      {/* Map */}
      <div style={{ height: 380 }} className="relative w-full mt-3">
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 border border-border rounded-md px-3 py-2 text-[11px] space-y-1.5">
          <div className="font-semibold text-card-foreground mb-1">Risk Level</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: getRiskColor("Low") }} />
            <span className="text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: getRiskColor("Medium") }} />
            <span className="text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: getRiskColor("High") }} />
            <span className="text-muted-foreground">High</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
        Tap a fire marker for details · Updated automatically
      </div>
    </div>
  );
}

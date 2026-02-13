import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface Props {
  customerZip?: string;
  compact?: boolean;
}

function formatTime(acq_time: string) {
  if (!acq_time || acq_time.length < 3) return acq_time;
  const padded = acq_time.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)} UTC`;
}

function getFrpColor(frp: number): string {
  if (frp < 1) return "#EAB308";
  if (frp <= 3) return "#F97316";
  return "#EF4444";
}

function getFrpRadius(frp: number): number {
  if (frp < 1) return 4;
  if (frp <= 3) return 7;
  if (frp <= 10) return 10;
  return 14;
}

export default function WildfireMap({ customerZip, compact = false }: Props) {
  const [fires, setFires] = useState<FirePoint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const fetchFires = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("firms-fires");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setFires(data.fires || []);
      setTotal(data.total || 0);
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

  const nearbyFires = customerZip
    ? fires.filter(() => true)
    : fires;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [37.5, -120],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri" }
    ).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Update markers when fire data changes
  useEffect(() => {
    if (!layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();

    const display = nearbyFires.length > 1000 ? nearbyFires.slice(0, 1000) : nearbyFires;

    display.forEach((f) => {
      const circle = L.circleMarker([f.latitude, f.longitude], {
        radius: getFrpRadius(f.frp),
        color: getFrpColor(f.frp),
        fillColor: getFrpColor(f.frp),
        fillOpacity: 0.7,
        weight: 1,
      });

      circle.bindTooltip(
        `<div style="font-size:11px;line-height:1.5">
          <b>Date:</b> ${f.acq_date}<br/>
          <b>Time:</b> ${formatTime(f.acq_time)}<br/>
          <b>FRP:</b> ${f.frp.toFixed(1)} MW<br/>
          <b>Confidence:</b> ${f.confidence}<br/>
          <b>Lat:</b> ${f.latitude.toFixed(4)}<br/>
          <b>Lng:</b> ${f.longitude.toFixed(4)}
        </div>`,
        { direction: "top", offset: [0, -6] }
      );

      circle.addTo(layerRef.current!);
    });

    if (display.length > 0) {
      const avgLat = display.reduce((s, f) => s + f.latitude, 0) / display.length;
      const avgLng = display.reduce((s, f) => s + f.longitude, 0) / display.length;
      mapRef.current.setView([avgLat, avgLng], 6);
    }
  }, [nearbyFires]);

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-card-foreground">Live Wildfire Activity</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">Real-time fire detections from NASA FIRMS (VIIRS NOAA-20). Shows thermal anomalies across California updated within hours.</p>
              </TooltipContent>
            </Tooltip>
            {!loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                {nearbyFires.length} active {nearbyFires.length === 1 ? "fire" : "fires"}
              </span>
            )}
          </div>
          <button onClick={fetchFires} disabled={loading} className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50" title="Refresh fire data">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 450 }} className="relative w-full">
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
          {loading && (
            <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 border border-border rounded-md px-3 py-2 text-[10px] space-y-1">
            <div className="font-semibold text-card-foreground mb-1">FRP (MW)</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#EAB308" }} />
              <span className="text-muted-foreground">&lt; 1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#F97316" }} />
              <span className="text-muted-foreground">1 – 3</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#EF4444" }} />
              <span className="text-muted-foreground">&gt; 3</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && nearbyFires.length > 0 && (
          <div className={`${compact ? "max-h-40" : "max-h-56"} overflow-y-auto`}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Date</th>
                  <th className="px-3 py-1.5 font-medium">Time</th>
                  <th className="px-3 py-1.5 font-medium">Confidence</th>
                  <th className="px-3 py-1.5 font-medium">FRP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nearbyFires.slice(0, compact ? 10 : 30).map((f, i) => (
                  <tr key={i} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-1.5 text-muted-foreground">{f.acq_date}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{formatTime(f.acq_time)}</td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">{f.confidence}</span>
                    </td>
                    <td className="px-3 py-1.5 text-card-foreground font-medium">{f.frp.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && nearbyFires.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No high-confidence fire detections in California right now.
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex justify-between">
          <span>Source: NASA FIRMS (VIIRS NOAA-20)</span>
          <span>{total} total detections, {nearbyFires.length} high-confidence</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

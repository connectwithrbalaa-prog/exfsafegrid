import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
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
  if (frp < 1) return "#EAB308";   // yellow
  if (frp <= 3) return "#F97316";  // orange
  return "#EF4444";                // red
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
    ? fires.filter(() => true) // Show all CA fires for now
    : fires;

  const displayFires = nearbyFires.length > 1000 ? nearbyFires.slice(0, 1000) : nearbyFires;

  const mapCenter = useMemo<[number, number]>(() => {
    if (nearbyFires.length === 0) return [37.5, -120];
    const avgLat = nearbyFires.reduce((s, f) => s + f.latitude, 0) / nearbyFires.length;
    const avgLng = nearbyFires.reduce((s, f) => s + f.longitude, 0) / nearbyFires.length;
    return [avgLat, avgLng];
  }, [nearbyFires]);

  const markers = useMemo(() => {
    return displayFires.map((f, i) => (
      <CircleMarker
        key={i}
        center={[f.latitude, f.longitude]}
        radius={getFrpRadius(f.frp)}
        pathOptions={{
          color: getFrpColor(f.frp),
          fillColor: getFrpColor(f.frp),
          fillOpacity: 0.7,
          weight: 1,
        }}
      >
        <LeafletTooltip direction="top" offset={[0, -6]}>
          <div className="text-xs space-y-0.5 font-sans">
            <div><strong>Date:</strong> {f.acq_date}</div>
            <div><strong>Time:</strong> {formatTime(f.acq_time)}</div>
            <div><strong>FRP:</strong> {f.frp.toFixed(1)} MW</div>
            <div><strong>Confidence:</strong> {f.confidence}</div>
            <div><strong>Lat:</strong> {f.latitude.toFixed(4)}</div>
            <div><strong>Lng:</strong> {f.longitude.toFixed(4)}</div>
          </div>
        </LeafletTooltip>
      </CircleMarker>
    ));
  }, [displayFires]);

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-card-foreground">
              Live Wildfire Activity
            </h3>
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
          <button
            onClick={fetchFires}
            disabled={loading}
            className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh fire data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Map */}
        {!error && nearbyFires.length > 0 && (
          <div style={{ height: 450 }} className="relative w-full">
            {loading && (
              <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <MapContainer
              center={mapCenter}
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              {markers}
            </MapContainer>
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
        )}

        {error && (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Table — no lat/lng columns */}
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
                      <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                        {f.confidence}
                      </span>
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

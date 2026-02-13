import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, RefreshCw, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function buildStaticMapUrl(fires: FirePoint[], center?: { lat: number; lng: number }) {
  const c = center || { lat: 37.5, lng: -120 };
  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${c.lat},${c.lng}&zoom=6&size=640x360&maptype=terrain&key=${GOOGLE_MAPS_KEY}`;

  // Add fire markers (limit to 50 for URL length)
  const markers = fires.slice(0, 50);
  if (markers.length > 0) {
    const pts = markers.map((f) => `${f.latitude},${f.longitude}`).join("|");
    url += `&markers=color:red|size:small|${pts}`;
  }

  return url;
}

function formatTime(acq_time: string) {
  if (!acq_time || acq_time.length < 3) return acq_time;
  const padded = acq_time.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)} UTC`;
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
    ? fires.filter((f) => {
        // Simple proximity filter for California regions
        // In production you'd geocode the ZIP and calculate distance
        return true; // Show all CA fires for now
      })
    : fires;

  const mapUrl = GOOGLE_MAPS_KEY ? buildStaticMapUrl(nearbyFires) : null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-destructive/5">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-card-foreground">
            Live Wildfire Activity
          </h3>
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
      {mapUrl && (
        <div className="relative">
          <img
            src={mapUrl}
            alt="California wildfire map showing active fire hotspots"
            className="w-full h-auto"
            loading="lazy"
          />
          {loading && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {!GOOGLE_MAPS_KEY && !loading && (
        <div className="p-4 text-center text-xs text-muted-foreground">
          <MapPin className="w-5 h-5 mx-auto mb-1" />
          Map unavailable — Google Maps key not configured
        </div>
      )}

      {error && (
        <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Fire data panel */}
      {!loading && !error && nearbyFires.length > 0 && (
        <div className={`${compact ? "max-h-40" : "max-h-56"} overflow-y-auto`}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Location</th>
                <th className="px-3 py-1.5 font-medium">Date</th>
                <th className="px-3 py-1.5 font-medium">Time</th>
                <th className="px-3 py-1.5 font-medium">Confidence</th>
                <th className="px-3 py-1.5 font-medium">FRP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nearbyFires.slice(0, compact ? 10 : 30).map((f, i) => (
                <tr key={i} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-1.5 font-mono text-card-foreground">
                    {f.latitude.toFixed(3)}, {f.longitude.toFixed(3)}
                  </td>
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
  );
}

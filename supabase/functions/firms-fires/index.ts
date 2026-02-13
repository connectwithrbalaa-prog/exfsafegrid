import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// California bounding box (approx)
const CA_COORDS = "-124.5,32.5,-114.0,42.0";

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

function parseCSV(csv: string): FirePoint[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results: FirePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",");
    if (vals.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = vals[idx]?.trim() || ""));

    results.push({
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      brightness: parseFloat(row.bright_ti4 || row.brightness || "0"),
      acq_date: row.acq_date || "",
      acq_time: row.acq_time || "",
      confidence: row.confidence || "",
      satellite: row.satellite || row.instrument || "",
      frp: parseFloat(row.frp || "0"),
      daynight: row.daynight || "",
    });
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const MAP_KEY = Deno.env.get("NASA_FIRMS_API_KEY");
    if (!MAP_KEY) {
      throw new Error("NASA_FIRMS_API_KEY is not configured");
    }

    // Fetch last 2 days of VIIRS NOAA-20 data for California
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_NOAA20_NRT/${CA_COORDS}/2`;
    console.log("Fetching FIRMS data:", url.replace(MAP_KEY, "***"));

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FIRMS API error [${res.status}]: ${text.slice(0, 200)}`);
    }

    const csv = await res.text();
    const fires = parseCSV(csv);

    // Filter to medium+ confidence fires
    const filtered = fires.filter((f) => {
      const conf = typeof f.confidence === "string" ? f.confidence.toLowerCase() : "";
      return conf === "high" || conf === "h" || conf === "nominal" || conf === "n" || Number(f.confidence) >= 50;
    });

    console.log(`FIRMS: ${fires.length} total fires, ${filtered.length} high-confidence`);

    return new Response(JSON.stringify({ fires: filtered, total: fires.length, filtered: filtered.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("firms-fires error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

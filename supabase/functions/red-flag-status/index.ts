import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NWS zone IDs mapped to GridGuard regions (California)
const REGION_ZONES: Record<string, string[]> = {
  "North Coast": ["CAZ006", "CAZ001", "CAZ002"],
  "North Valley/Sierra": ["CAZ015", "CAZ016", "CAZ069"],
  "Bay Area": ["CAZ006", "CAZ508", "CAZ510"],
  "Central Coast": ["CAZ529", "CAZ530", "CAZ034"],
  "Central Valley": ["CAZ017", "CAZ018", "CAZ019"],
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, { active: boolean; headline?: string }> = {};

    // Check NWS alerts for Red Flag Warnings across all regions
    const nwsUrl = "https://api.weather.gov/alerts/active?area=CA&event=Red%20Flag%20Warning";
    const nwsRes = await fetch(nwsUrl, {
      headers: { "User-Agent": "GridGuard/1.0 (gridguard-demo)" },
    });

    let activeZones: Set<string> = new Set();
    let alertHeadlines: Map<string, string> = new Map();

    if (nwsRes.ok) {
      const data = await nwsRes.json();
      const features = data.features || [];
      for (const f of features) {
        const zones: string[] = f.properties?.geocode?.UGC || [];
        const headline: string = f.properties?.headline || "Red Flag Warning";
        for (const z of zones) {
          activeZones.add(z);
          if (!alertHeadlines.has(z)) alertHeadlines.set(z, headline);
        }
      }
    }

    for (const [region, zones] of Object.entries(REGION_ZONES)) {
      const matchedZone = zones.find((z) => activeZones.has(z));
      results[region] = {
        active: !!matchedZone,
        headline: matchedZone ? alertHeadlines.get(matchedZone) : undefined,
      };
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("red-flag-status error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

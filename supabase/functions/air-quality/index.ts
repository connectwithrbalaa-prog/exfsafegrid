/**
 * air-quality — GET air quality data from Open-Meteo Air Quality API
 * Returns current AQI, PM2.5, PM10 for a given lat/lng or ZIP centroid.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ZIP → approximate lat/lng centroids for common California utility service areas
const ZIP_COORDS: Record<string, [number, number]> = {
  "94110": [37.75, -122.42], "94103": [37.77, -122.41], "94612": [37.81, -122.27],
  "95401": [38.44, -122.71], "95630": [38.67, -121.27], "93001": [34.27, -119.23],
  "93401": [35.28, -120.66], "91101": [34.15, -118.14], "92101": [32.72, -117.16],
  "95060": [36.97, -122.03], "96001": [40.59, -122.39], "95482": [39.15, -123.21],
  "93950": [36.57, -121.95], "93101": [34.42, -119.70], "95616": [38.55, -121.74],
};

function getCoords(zip: string): [number, number] {
  return ZIP_COORDS[zip] ?? [37.77, -122.42]; // default SF
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const zip = url.searchParams.get("zip") ?? "94110";
    const [lat, lng] = getCoords(zip);

    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10,carbon_monoxide,ozone&timezone=America/Los_Angeles`;

    const res = await fetch(aqUrl);
    if (!res.ok) throw new Error(`Open-Meteo AQ API returned ${res.status}`);
    const data = await res.json();

    const current = data.current ?? {};
    const aqi = current.us_aqi ?? 0;

    let level = "Good";
    let color = "#22c55e";
    let advice = "Air quality is good. No precautions needed.";

    if (aqi > 300) {
      level = "Hazardous"; color = "#7f1d1d";
      advice = "Health emergency. Everyone should avoid outdoor activity. Stay indoors with windows closed.";
    } else if (aqi > 200) {
      level = "Very Unhealthy"; color = "#9333ea";
      advice = "Health alert. Everyone may experience serious effects. Avoid outdoor activity.";
    } else if (aqi > 150) {
      level = "Unhealthy"; color = "#dc2626";
      advice = "Everyone may begin to experience health effects. Sensitive groups should stay indoors.";
    } else if (aqi > 100) {
      level = "Unhealthy for Sensitive Groups"; color = "#f97316";
      advice = "Sensitive groups (elderly, children, respiratory conditions) should limit outdoor exposure.";
    } else if (aqi > 50) {
      level = "Moderate"; color = "#eab308";
      advice = "Air quality is acceptable. Unusually sensitive people should consider reducing prolonged outdoor exertion.";
    }

    return new Response(JSON.stringify({
      zip,
      aqi,
      level,
      color,
      advice,
      pm2_5: current.pm2_5 ?? null,
      pm10: current.pm10 ?? null,
      co: current.carbon_monoxide ?? null,
      ozone: current.ozone ?? null,
      timestamp: current.time ?? new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

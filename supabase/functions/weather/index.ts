import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Grid of sample points covering the Sierra Nevada / Central Valley fire region
const WEATHER_POINTS = [
  { id: "wp-1", label: "Mariposa Grove", lat: 37.50, lng: -119.60 },
  { id: "wp-2", label: "Oakhurst", lat: 37.33, lng: -119.65 },
  { id: "wp-3", label: "Bass Lake", lat: 37.32, lng: -119.56 },
  { id: "wp-4", label: "Fish Camp", lat: 37.48, lng: -119.64 },
  { id: "wp-5", label: "North Fork", lat: 37.23, lng: -119.51 },
  { id: "wp-6", label: "Coarsegold", lat: 37.26, lng: -119.70 },
  { id: "wp-7", label: "Yosemite Valley", lat: 37.74, lng: -119.59 },
  { id: "wp-8", label: "El Portal", lat: 37.67, lng: -119.78 },
  { id: "wp-9", label: "Wawona", lat: 37.54, lng: -119.66 },
  { id: "wp-10", label: "Ahwahnee", lat: 37.36, lng: -119.73 },
  { id: "wp-11", label: "Raymond", lat: 37.21, lng: -119.91 },
  { id: "wp-12", label: "Midpines", lat: 37.56, lng: -119.97 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lats = WEATHER_POINTS.map((p) => p.lat).join(",");
    const lngs = WEATHER_POINTS.map((p) => p.lng).join(",");

    // Open-Meteo free API – current weather for multiple locations
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Los_Angeles`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Open-Meteo API error [${res.status}]: ${body}`);
    }

    const raw = await res.json();

    // Open-Meteo returns an array when multiple locations are queried
    const results = Array.isArray(raw) ? raw : [raw];

    const weatherPoints = results.map((r: any, i: number) => {
      const c = r.current;
      return {
        id: WEATHER_POINTS[i].id,
        label: WEATHER_POINTS[i].label,
        latitude: WEATHER_POINTS[i].lat,
        longitude: WEATHER_POINTS[i].lng,
        temperature_f: c.temperature_2m,
        humidity_pct: c.relative_humidity_2m,
        wind_speed_mph: c.wind_speed_10m,
        wind_direction_deg: c.wind_direction_10m,
        weather_code: c.weather_code,
      };
    });

    return new Response(JSON.stringify({ weather: weatherPoints }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Weather fetch error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

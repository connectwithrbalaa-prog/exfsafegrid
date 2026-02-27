const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BACKEND_URL = Deno.env.get("BACKEND_API_URL");
  const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY");

  if (!BACKEND_URL) {
    console.error("BACKEND_API_URL not configured");
    return new Response(
      JSON.stringify({ error: "BACKEND_API_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const targetPath = url.searchParams.get("path") || "/health";
    url.searchParams.delete("path");

    const targetUrl = new URL(targetPath, BACKEND_URL);
    url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    console.log(`Proxying ${req.method} ${targetUrl.toString()}`);

    const fetchInit: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(BACKEND_KEY ? { "X-API-Key": BACKEND_KEY } : {}),
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        fetchInit.body = await req.text();
      } catch {
        // no body
      }
    }

    const upstream = await fetch(targetUrl.toString(), fetchInit);
    const body = await upstream.text();

    // Optional resources: return empty JSON instead of 404/500 to avoid noisy runtime errors.
    if (
      (upstream.status === 404 || upstream.status === 500) &&
      (targetPath === "/briefing" || targetPath === "/psps-watchlist")
    ) {
      console.log(`Upstream ${targetPath} returned ${upstream.status}; returning null payload`);
      return new Response("null", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback for /incidents/active
    if (
      (upstream.status === 404 || upstream.status === 500) &&
      targetPath === "/incidents/active"
    ) {
      console.log(`Upstream /incidents/active returned ${upstream.status}; returning demo data`);
      return new Response(JSON.stringify({ incidents: [], demo: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback for /ingestion/status
    if (
      (upstream.status === 404 || upstream.status === 500) &&
      targetPath === "/ingestion/status"
    ) {
      console.log(`Upstream /ingestion/status returned ${upstream.status}; returning demo data`);
      return new Response(JSON.stringify({ status: "unavailable", pipelines: [], demo: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demo fallback for agent endpoints not yet deployed on backend
    if (upstream.status === 404 && targetPath === "/agent/risk-12h") {
      console.log("Upstream /agent/risk-12h missing; returning demo data");
      const now = Date.now();
      const hourly = Array.from({ length: 12 }, (_, i) => ({
        time: new Date(now - (11 - i) * 3600000).toISOString(),
        prob: +(0.25 + 0.15 * Math.sin(i / 2) + Math.random() * 0.08).toFixed(3),
      }));
      const first3 = hourly.slice(0, 3).reduce((s, p) => s + p.prob, 0) / 3;
      const last3 = hourly.slice(-3).reduce((s, p) => s + p.prob, 0) / 3;
      const trend_label = last3 - first3 > 0.05 ? "RISING" : last3 - first3 < -0.05 ? "FALLING" : "STABLE";
      return new Response(JSON.stringify({
        circuit_id: url.searchParams.get("circuit_id") || "UNKNOWN",
        trend_label, hourly, demo: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (upstream.status === 404 && targetPath === "/agent/nearby-sensors") {
      console.log("Upstream /agent/nearby-sensors missing; returning demo data");
      const lat = parseFloat(url.searchParams.get("lat") || "0");
      const lon = parseFloat(url.searchParams.get("lon") || "0");
      return new Response(JSON.stringify({
        lat, lon, radius_miles: 25,
        raws_stations: [
          { station_id: "RAWS-001", station_name: "Mt. Diablo RAWS", distance_miles: 4.2,
            obs_time: new Date().toISOString(), temp_f: 82, rh_pct: 15,
            wind_speed_mph: 18, wind_gust_mph: 32, wind_dir_deg: 45,
            erc: 72, bi: 88, ffwi: 62, precip_in: 0 },
          { station_id: "RAWS-002", station_name: "San Bruno Mtn RAWS", distance_miles: 8.7,
            obs_time: new Date().toISOString(), temp_f: 78, rh_pct: 22,
            wind_speed_mph: 12, wind_gust_mph: 22, wind_dir_deg: 0,
            erc: 65, bi: 74, ffwi: 51, precip_in: 0 },
        ],
        cameras: [],
        summary: "Elevated fire weather conditions detected. Sustained winds 18 mph with gusts to 32 mph from the NE. Relative humidity critically low at 15%. ERC of 72 indicates high energy release potential.",
        demo: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Demo fallback for /api/risk/trends
    if ((upstream.status === 404 || upstream.status === 500) && targetPath === "/api/risk/trends") {
      console.log("Upstream /api/risk/trends missing; returning demo data");
      const circuitId = url.searchParams.get("circuit_id") || "UNKNOWN";
      const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "3"), 2), 7);
      const now = new Date();
      const bucketOf = (p: number) => p >= 0.7 ? "CRITICAL" : p >= 0.5 ? "HIGH" : p >= 0.3 ? "MODERATE" : "LOW";
      const probabilities = Array.from({ length: days }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (days - 1 - i));
        const p = +(0.3 + 0.12 * i + Math.random() * 0.1).toFixed(3);
        return { date: d.toISOString().slice(0, 10), p: Math.min(p, 0.95), risk_bucket: bucketOf(Math.min(p, 0.95)) };
      });
      const delta = probabilities[probabilities.length - 1].p - probabilities[0].p;
      const trend_label = delta > 0.15 ? "APPROACHING" : delta > 0.05 ? "RISING" : delta < -0.1 ? "FALLING" : "STABLE";
      const lastP = probabilities[probabilities.length - 1];
      const wantSummary = url.searchParams.get("summary") === "true";
      return new Response(JSON.stringify({
        circuit_id: circuitId,
        trend_label,
        probabilities,
        summary: wantSummary
          ? `Risk has ${delta > 0 ? "increased" : "decreased"} over ${days} days and is now ${lastP.risk_bucket} (${Math.round(lastP.p * 100)}%).`
          : null,
        demo: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback demo data for prediction endpoints returning 500
    if (upstream.status === 500 && targetPath === "/circuit-ignition-risk") {
      console.log("Upstream /circuit-ignition-risk returned 500; returning demo data");
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const horizon = parseInt(url.searchParams.get("horizon_hours") || "24");
      const circuits = ["CKT-1103","CKT-2201","CKT-2205","CKT-1407","CKT-3301","CKT-4402","CKT-5501","CKT-6603","CKT-7704","CKT-8805"];
      const bands = ["LOW","MODERATE","HIGH","CRITICAL"];
      const predictions = circuits.slice(0, Math.min(limit, circuits.length)).map((cid, i) => {
        const p = +(0.15 + 0.08 * i + Math.random() * 0.1).toFixed(3);
        return {
          circuit_id: cid, psa_id: `PSA-${100 + i}`, horizon_hours: horizon,
          probability: Math.min(p, 0.95),
          risk_band: bands[Math.min(Math.floor(p / 0.25), 3)],
          prediction_date: new Date().toISOString().slice(0, 10),
          top_features: ["wind_speed", "rh_pct", "erc"],
        };
      });
      return new Response(JSON.stringify({ predictions, demo: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (upstream.status === 500 && targetPath === "/psa-risk") {
      console.log("Upstream /psa-risk returned 500; returning demo data");
      const psas = ["PSA-101","PSA-102","PSA-103","PSA-104","PSA-105"];
      const predictions = psas.map((pid, i) => {
        const p = +(0.2 + 0.1 * i + Math.random() * 0.08).toFixed(3);
        return {
          psa_id: pid, month_offset: 1, probability: Math.min(p, 0.95),
          risk_band: p >= 0.7 ? "CRITICAL" : p >= 0.5 ? "HIGH" : p >= 0.3 ? "MODERATE" : "LOW",
          prediction_date: new Date().toISOString().slice(0, 10),
        };
      });
      return new Response(JSON.stringify({ predictions, demo: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Upstream responded ${upstream.status}`);

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err: any) {
    console.error("Backend proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Backend proxy failed", detail: err.message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildDemoFallback(targetPath: string, url: URL, status: number | "network_error") {
  const isOptionalFailure =
    status === "network_error" || status === 404 || status === 500 || status === 502 || status === 503 || status === 504;

  if (!isOptionalFailure) return null;

  if (targetPath === "/health") {
    console.log(`Upstream /health unavailable (${status}); returning demo health`);
    return jsonResponse({ status: "demo", message: "Backend unreachable – using fallback data", demo: true }, 200);
  }

  if (targetPath === "/briefing" || targetPath === "/psps-watchlist") {
    console.log(`Upstream ${targetPath} unavailable (${status}); returning null payload`);
    return jsonResponse("null", 200);
  }

  if (targetPath === "/incidents/active") {
    console.log(`Upstream /incidents/active unavailable (${status}); returning demo data`);
    return jsonResponse({ incidents: [], demo: true }, 200);
  }

  if (targetPath === "/ingestion/status") {
    console.log(`Upstream /ingestion/status unavailable (${status}); returning demo data`);
    return jsonResponse({ status: "unavailable", pipelines: [], demo: true }, 200);
  }

  if (targetPath === "/agent/risk-12h") {
    console.log(`Upstream /agent/risk-12h unavailable (${status}); returning demo data`);
    const now = Date.now();
    const hourly = Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 3600000).toISOString(),
      prob: +(0.25 + 0.15 * Math.sin(i / 2) + Math.random() * 0.08).toFixed(3),
    }));
    const first3 = hourly.slice(0, 3).reduce((s, p) => s + p.prob, 0) / 3;
    const last3 = hourly.slice(-3).reduce((s, p) => s + p.prob, 0) / 3;
    const trend_label = last3 - first3 > 0.05 ? "RISING" : last3 - first3 < -0.05 ? "FALLING" : "STABLE";

    return jsonResponse(
      {
        circuit_id: url.searchParams.get("circuit_id") || "UNKNOWN",
        trend_label,
        hourly,
        demo: true,
      },
      200
    );
  }

  if (targetPath === "/agent/nearby-sensors") {
    console.log(`Upstream /agent/nearby-sensors unavailable (${status}); returning demo data`);
    const lat = parseFloat(url.searchParams.get("lat") || "0");
    const lon = parseFloat(url.searchParams.get("lon") || "0");

    return jsonResponse(
      {
        lat,
        lon,
        radius_miles: 25,
        raws_stations: [
          {
            station_id: "RAWS-001",
            station_name: "Mt. Diablo RAWS",
            distance_miles: 4.2,
            obs_time: new Date().toISOString(),
            temp_f: 82,
            rh_pct: 15,
            wind_speed_mph: 18,
            wind_gust_mph: 32,
            wind_dir_deg: 45,
            erc: 72,
            bi: 88,
            ffwi: 62,
            precip_in: 0,
          },
          {
            station_id: "RAWS-002",
            station_name: "San Bruno Mtn RAWS",
            distance_miles: 8.7,
            obs_time: new Date().toISOString(),
            temp_f: 78,
            rh_pct: 22,
            wind_speed_mph: 12,
            wind_gust_mph: 22,
            wind_dir_deg: 0,
            erc: 65,
            bi: 74,
            ffwi: 51,
            precip_in: 0,
          },
        ],
        cameras: [],
        summary:
          "Elevated fire weather conditions detected. Sustained winds 18 mph with gusts to 32 mph from the NE. Relative humidity critically low at 15%. ERC of 72 indicates high energy release potential.",
        demo: true,
      },
      200
    );
  }

  if (targetPath === "/api/risk/trends") {
    console.log(`Upstream /api/risk/trends unavailable (${status}); returning demo data`);
    const circuitId = url.searchParams.get("circuit_id") || "UNKNOWN";
    const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "3"), 2), 7);
    const now = new Date();
    const bucketOf = (p: number) => (p >= 0.7 ? "CRITICAL" : p >= 0.5 ? "HIGH" : p >= 0.3 ? "MODERATE" : "LOW");
    const probabilities = Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const p = +(0.3 + 0.12 * i + Math.random() * 0.1).toFixed(3);
      const normalized = Math.min(p, 0.95);
      return { date: d.toISOString().slice(0, 10), p: normalized, risk_bucket: bucketOf(normalized) };
    });
    const delta = probabilities[probabilities.length - 1].p - probabilities[0].p;
    const trend_label = delta > 0.15 ? "APPROACHING" : delta > 0.05 ? "RISING" : delta < -0.1 ? "FALLING" : "STABLE";
    const lastP = probabilities[probabilities.length - 1];
    const wantSummary = url.searchParams.get("summary") === "true";

    return jsonResponse(
      {
        circuit_id: circuitId,
        trend_label,
        probabilities,
        summary: wantSummary
          ? `Risk has ${delta > 0 ? "increased" : "decreased"} over ${days} days and is now ${lastP.risk_bucket} (${Math.round(
              lastP.p * 100
            )}%).`
          : null,
        demo: true,
      },
      200
    );
  }

  if (targetPath === "/circuit-ignition-risk") {
    console.log(`Upstream /circuit-ignition-risk unavailable (${status}); returning demo data`);
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const horizon = parseInt(url.searchParams.get("horizon_hours") || "24");
    const circuits = [
      "CKT-1103",
      "CKT-2201",
      "CKT-2205",
      "CKT-1407",
      "CKT-3301",
      "CKT-4402",
      "CKT-5501",
      "CKT-6603",
      "CKT-7704",
      "CKT-8805",
    ];
    const bands = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
    const predictions = circuits.slice(0, Math.min(limit, circuits.length)).map((cid, i) => {
      const p = +(0.15 + 0.08 * i + Math.random() * 0.1).toFixed(3);
      return {
        circuit_id: cid,
        psa_id: `PSA-${100 + i}`,
        horizon_hours: horizon,
        probability: Math.min(p, 0.95),
        risk_band: bands[Math.min(Math.floor(p / 0.25), 3)],
        prediction_date: new Date().toISOString().slice(0, 10),
        top_features: ["wind_speed", "rh_pct", "erc"],
      };
    });

    return jsonResponse({ predictions, demo: true }, 200);
  }

  if (targetPath === "/psa-risk") {
    console.log(`Upstream /psa-risk unavailable (${status}); returning demo data`);
    const psas = ["PSA-101", "PSA-102", "PSA-103", "PSA-104", "PSA-105"];
    const predictions = psas.map((pid, i) => {
      const p = +(0.2 + 0.1 * i + Math.random() * 0.08).toFixed(3);
      return {
        psa_id: pid,
        month_offset: 1,
        probability: Math.min(p, 0.95),
        risk_band: p >= 0.7 ? "CRITICAL" : p >= 0.5 ? "HIGH" : p >= 0.3 ? "MODERATE" : "LOW",
        prediction_date: new Date().toISOString().slice(0, 10),
      };
    });

    return jsonResponse({ predictions, demo: true }, 200);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BACKEND_URL = Deno.env.get("BACKEND_API_URL");
  const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY");

  if (!BACKEND_URL) {
    console.error("BACKEND_API_URL not configured");
    return jsonResponse({ error: "BACKEND_API_URL not configured" }, 500);
  }

  let url: URL | null = null;
  let targetPath = "/health";

  try {
    url = new URL(req.url);
    targetPath = url.searchParams.get("path") || "/health";
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("upstream_timeout"), 20000);

    let upstream: Response;
    try {
      upstream = await fetch(targetUrl.toString(), {
        ...fetchInit,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const fallback = buildDemoFallback(targetPath, url, upstream.status);
    if (fallback) return fallback;

    const body = await upstream.text();
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

    if (url) {
      const fallback = buildDemoFallback(targetPath, url, "network_error");
      if (fallback) return fallback;
    }

    return jsonResponse({ error: "Backend proxy failed", detail: err?.message ?? String(err) }, 502);
  }
});

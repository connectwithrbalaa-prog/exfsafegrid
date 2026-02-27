/**
 * assets-risk-list — GET /api/assets/risk-list
 * Returns circuit/asset data enriched with risk scores from model_predictions.
 * Falls back to demo data when the external backend is unavailable.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REGIONS = ["North Coast", "North Valley/Sierra", "Bay Area", "Central Coast", "Central Valley"];
const BANDS = ["CRITICAL", "HIGH", "MODERATE", "LOW"];
const ASSET_TYPES = ["Distribution", "Transmission", "Substation"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const regionFilter = url.searchParams.get("region") || "";
  const bandFilter = url.searchParams.get("risk_band") || "";
  const typeFilter = url.searchParams.get("asset_type") || "";

  // Try to fetch from external backend first
  const BACKEND_URL = Deno.env.get("BACKEND_API_URL");
  const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY");

  if (BACKEND_URL) {
    try {
      const targetUrl = new URL("/api/assets/risk-list", BACKEND_URL);
      if (regionFilter) targetUrl.searchParams.set("region", regionFilter);
      if (bandFilter) targetUrl.searchParams.set("risk_band", bandFilter);
      if (typeFilter) targetUrl.searchParams.set("asset_type", typeFilter);

      const upstream = await fetch(targetUrl.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...(BACKEND_KEY ? { "X-API-Key": BACKEND_KEY } : {}),
        },
      });

      if (upstream.ok) {
        const body = await upstream.text();
        return new Response(body, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.log("Backend unavailable, falling back to demo data:", e);
    }
  }

  // Demo fallback: generate realistic circuit risk data
  const circuits = [
    { circuit_id: "CKT-1103", region: "Bay Area", asset_type: "Distribution", county: "Santa Clara", voltage_kv: 12, customer_count: 4200, critical_facilities: 3 },
    { circuit_id: "CKT-2201", region: "Central Coast", asset_type: "Distribution", county: "Ventura", voltage_kv: 12, customer_count: 3800, critical_facilities: 2 },
    { circuit_id: "CKT-2205", region: "Central Coast", asset_type: "Transmission", county: "Santa Barbara", voltage_kv: 115, customer_count: 12500, critical_facilities: 8 },
    { circuit_id: "CKT-1407", region: "Bay Area", asset_type: "Substation", county: "San Mateo", voltage_kv: 60, customer_count: 8900, critical_facilities: 5 },
    { circuit_id: "CKT-3301", region: "North Coast", asset_type: "Distribution", county: "Sonoma", voltage_kv: 12, customer_count: 2100, critical_facilities: 1 },
    { circuit_id: "CKT-4402", region: "North Valley/Sierra", asset_type: "Distribution", county: "Butte", voltage_kv: 12, customer_count: 5600, critical_facilities: 4 },
    { circuit_id: "CKT-5501", region: "Central Valley", asset_type: "Transmission", county: "Fresno", voltage_kv: 230, customer_count: 15200, critical_facilities: 12 },
    { circuit_id: "CKT-6603", region: "North Coast", asset_type: "Distribution", county: "Mendocino", voltage_kv: 12, customer_count: 1800, critical_facilities: 1 },
    { circuit_id: "CKT-7704", region: "Bay Area", asset_type: "Distribution", county: "Contra Costa", voltage_kv: 21, customer_count: 6700, critical_facilities: 6 },
    { circuit_id: "CKT-8805", region: "Central Coast", asset_type: "Substation", county: "San Luis Obispo", voltage_kv: 60, customer_count: 4500, critical_facilities: 3 },
    { circuit_id: "CKT-9901", region: "North Valley/Sierra", asset_type: "Transmission", county: "Shasta", voltage_kv: 115, customer_count: 9200, critical_facilities: 7 },
    { circuit_id: "CKT-1002", region: "Central Valley", asset_type: "Distribution", county: "Kern", voltage_kv: 12, customer_count: 3400, critical_facilities: 2 },
  ];

  // Assign risk scores deterministically
  const seeded = circuits.map((c, i) => {
    const prob = Math.min(0.95, +(0.12 + 0.065 * i + (i % 3) * 0.08).toFixed(3));
    const band = prob >= 0.7 ? "CRITICAL" : prob >= 0.5 ? "HIGH" : prob >= 0.3 ? "MODERATE" : "LOW";
    const priority = i + 1;
    return { ...c, risk_score: prob, risk_band: band, priority_rank: priority };
  });

  // Sort by risk_score descending
  seeded.sort((a, b) => b.risk_score - a.risk_score);
  seeded.forEach((c, i) => c.priority_rank = i + 1);

  // Apply filters
  let results = seeded;
  if (regionFilter) results = results.filter((c) => c.region === regionFilter);
  if (bandFilter) results = results.filter((c) => c.risk_band === bandFilter);
  if (typeFilter) results = results.filter((c) => c.asset_type === typeFilter);

  return new Response(JSON.stringify({ assets: results, total: results.length, demo: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

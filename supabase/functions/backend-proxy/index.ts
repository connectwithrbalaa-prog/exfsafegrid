import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BACKEND_URL = Deno.env.get("BACKEND_API_URL");
  const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY");

  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({ error: "BACKEND_API_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    // Extract the path after /backend-proxy — this becomes the FastAPI path
    // e.g. /backend-proxy?path=/psa-risk&psa_id=CA-01 → GET BACKEND_URL/psa-risk?psa_id=CA-01
    const targetPath = url.searchParams.get("path") || "/health";
    url.searchParams.delete("path");

    // Build target URL with remaining query params
    const targetUrl = new URL(targetPath, BACKEND_URL);
    url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    // Forward method and body
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

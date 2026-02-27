import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKEND_URL = (Deno.env.get("BACKEND_API_URL") ?? "").replace(/\/$/, "");
const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY") ?? "";

// ── Fetch prediction data from the FastAPI backend ────────────────────────

type FetchResult = { data: unknown; ok: true } | { ok: false; reason: "no_url" | "network_error" | "http_error"; status?: number };

async function backendGet(path: string): Promise<FetchResult> {
  if (!BACKEND_URL) return { ok: false, reason: "no_url" };
  try {
    const r = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "X-API-Key": BACKEND_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, reason: "http_error", status: r.status };
    const data = await r.json();
    return { ok: true, data };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

function extractIds(text: string) {
  const psa = text.match(/PSA[_\s-]?(\w+)/gi)?.map((s) => s.replace(/[_\s-]/g, "_").toUpperCase()) ?? [];
  const ckt = text.match(/CIRCUIT[_\s-]?\w+/gi)?.map((s) => s.replace(/[_\s-]/g, "_").toUpperCase()) ?? [];
  return { psa, ckt };
}

async function gatherContext(question: string): Promise<{ ctx: Record<string, unknown>; backendStatus: string }> {
  const { psa, ckt } = extractIds(question);
  const q = question.toLowerCase();
  const ctx: Record<string, unknown> = {};
  const errors: string[] = [];

  const needsPsa  = psa.length > 0 || q.includes("psa") || q.includes("density") || q.includes("risk") || q.includes("activity");
  const needsCkt  = ckt.length > 0 || q.includes("circuit") || q.includes("ignition") || q.includes("spike") || q.includes("critical");
  const needsBoth = !needsPsa && !needsCkt;

  if (needsPsa || needsBoth) {
    const qs = psa.length > 0 ? `psa_id=${psa[0]}&limit=20` : "limit=20";
    const r = await backendGet(`/psa-risk?${qs}`);
    if (r.ok) ctx.psa_risk = r.data;
    else errors.push(`psa_risk: ${r.reason}`);
  }

  if (needsCkt || needsBoth) {
    const qs = ckt.length > 0 ? `circuit_id=${ckt[0]}&limit=20` : "limit=20";
    const r = await backendGet(`/circuit-ignition-risk?${qs}`);
    if (r.ok) ctx.circuit_risk = r.data;
    else errors.push(`circuit_risk: ${r.reason}`);
  }

  if (q.includes("trend") && (psa.length > 0 || ckt.length > 0)) {
    const id = ckt[0] ?? psa[0];
    const r = await backendGet(`/api/risk/trends?circuit_id=${id}&days=5&summary=false`);
    if (r.ok) ctx.risk_trends = r.data;
    else errors.push(`risk_trends: ${r.reason}`);
  }

  if (q.includes("incident") || q.includes("fire") || q.includes("active")) {
    const r = await backendGet("/incidents/active?limit=10");
    if (r.ok) ctx.active_incidents = r.data;
    else errors.push(`incidents: ${r.reason}`);
  }

  // Determine a concise backend status string for the AI
  const hasData = Object.keys(ctx).length > 0;
  let backendStatus: string;

  if (!BACKEND_URL) {
    backendStatus = "BACKEND_NOT_CONFIGURED";
  } else if (hasData) {
    backendStatus = errors.length > 0 ? `PARTIAL_DATA (some endpoints unavailable: ${errors.join(", ")})` : "OK";
  } else {
    const reasons = new Set(errors.map((e) => e.split(": ")[1]));
    if (reasons.has("network_error")) backendStatus = "NETWORK_UNREACHABLE";
    else if (reasons.has("http_error")) backendStatus = "BACKEND_ERROR";
    else backendStatus = "NO_DATA";
  }

  return { ctx, backendStatus };
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM = `You are the ML Predictions Assistant for ExfSafeGrid, an AI-powered wildfire risk management platform used by utility operations teams.

You answer natural-language questions about:
- PSA (Predictive Service Area) wildfire activity risk — Model A (1-3 month horizon)
- Circuit ignition spike risk — Model B (24h / 48h / 72h horizons)
- Risk trends (rising / falling / stable over recent days)
- Customer density, HFTD tiers, and critical infrastructure at risk
- Active fire incidents and outlooks

RESPONSE STYLE:
- Be direct and data-driven. Ops teams want facts, not hedging.
- Use tables or bullet lists when comparing multiple circuits or PSAs.
- Always state the risk level (LOW / MODERATE / HIGH / CRITICAL) and the probability score (0–1).
- If asked about customer density, reference customer_count from the prediction results.
- Keep answers concise — under 200 words unless the user explicitly asks for detail.

BACKEND STATUS HANDLING — follow these rules exactly based on the BACKEND_STATUS value below:
- OK or PARTIAL_DATA: Answer using the data provided. Note any missing data sources if relevant.
- BACKEND_NOT_CONFIGURED: Say "The backend API URL is not configured yet. Ask your admin to set BACKEND_API_URL in the Supabase edge function secrets." Do not mention server errors.
- NETWORK_UNREACHABLE: Say "The backend is not reachable from this environment (likely a preview/sandbox limitation). Once deployed to production with the correct BACKEND_API_URL, live predictions will appear here." Do not say "server error".
- BACKEND_ERROR or NO_DATA: Say "The backend returned no prediction data. Go to Backend Ops → Train All Models → Score Circuits to generate predictions, then retry." Do not say "server error".

DATA FORMAT NOTES:
- prob_above_normal / prob_spike: 0–1 probability score
- risk_bucket: LOW | MODERATE | HIGH | CRITICAL
- customer_count: residential + commercial customers on the circuit
- critical_customers: medical baseline / life-support customers
- hftd_tier: High Fire Threat District tier (2 = elevated, 3 = highest)`;

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json() as { messages: { role: string; content: string }[] };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const { ctx, backendStatus } = await gatherContext(lastUserMsg);
    const hasData = Object.keys(ctx).length > 0;

    const dataBlock = hasData
      ? `\n\nBACKEND_STATUS: ${backendStatus}\n\nCURRENT PREDICTION DATA:\n${JSON.stringify(ctx, null, 2)}`
      : `\n\nBACKEND_STATUS: ${backendStatus}\n\nNo prediction data retrieved.`;

    const systemContent = SYSTEM + dataBlock;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("ml-chat AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ml-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

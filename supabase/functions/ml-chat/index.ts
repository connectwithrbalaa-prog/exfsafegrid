import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKEND_URL = (Deno.env.get("BACKEND_API_URL") ?? "").replace(/\/$/, "");
const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY") ?? "";

// ── Fetch prediction data from the FastAPI backend ────────────────────────

async function backendGet(path: string): Promise<unknown | null> {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "X-API-Key": BACKEND_KEY },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function extractIds(text: string) {
  const psa = text.match(/PSA[_\s-]?(\w+)/gi)?.map((s) => s.replace(/[_\s-]/g, "_").toUpperCase()) ?? [];
  const ckt = text.match(/CIRCUIT[_\s-]?\w+/gi)?.map((s) => s.replace(/[_\s-]/g, "_").toUpperCase()) ?? [];
  return { psa, ckt };
}

async function gatherContext(question: string): Promise<Record<string, unknown>> {
  const { psa, ckt } = extractIds(question);
  const q = question.toLowerCase();
  const ctx: Record<string, unknown> = {};

  // Always fetch a top-level summary if no specific ID was detected
  const needsPsa  = psa.length > 0 || q.includes("psa") || q.includes("density") || q.includes("risk") || q.includes("activity");
  const needsCkt  = ckt.length > 0 || q.includes("circuit") || q.includes("ignition") || q.includes("spike");
  const needsBoth = !needsPsa && !needsCkt; // fallback: fetch both

  if (needsPsa || needsBoth) {
    const qs = psa.length > 0 ? `psa_id=${psa[0]}&limit=20` : "limit=20";
    ctx.psa_risk = await backendGet(`/psa-risk?${qs}`);
  }

  if (needsCkt || needsBoth) {
    const qs = ckt.length > 0 ? `circuit_id=${ckt[0]}&limit=20` : "limit=20";
    ctx.circuit_risk = await backendGet(`/circuit-ignition-risk?${qs}`);
  }

  if (q.includes("trend") && (psa.length > 0 || ckt.length > 0)) {
    const id = ckt[0] ?? psa[0];
    ctx.risk_trends = await backendGet(`/api/risk/trends?circuit_id=${id}&days=5&summary=false`);
  }

  if (q.includes("incident") || q.includes("fire") || q.includes("active")) {
    ctx.active_incidents = await backendGet("/incidents/active?limit=10");
  }

  return ctx;
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
- If backend data is unavailable, explain that models need to be trained and scored first.
- Keep answers concise — under 200 words unless the user explicitly asks for detail.

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

    // Fetch relevant prediction data from the FastAPI backend
    const backendCtx = await gatherContext(lastUserMsg);
    const hasData = Object.values(backendCtx).some((v) => v !== null);

    const dataBlock = hasData
      ? `\n\nCURRENT PREDICTION DATA (from ExfSafeGrid backend):\n${JSON.stringify(backendCtx, null, 2)}`
      : "\n\nNOTE: No backend prediction data available. Advise the user to train and score models first (Backend Ops panel → Train All Models → Score Circuits).";

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

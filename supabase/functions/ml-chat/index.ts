import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the ExfSafeGrid ML Predictions Assistant. You help users query wildfire risk predictions from three machine learning models and customer density data:

1. **PSA Risk Model (Model A)** — Predicts above-normal wildfire activity risk per PSA (Predictive Service Area) over a 1–3 month horizon.
   - Parameters: psa_id, month_offset (1-3), min_prob (0-1), prediction_date, limit
   
2. **Circuit Ignition Spike Model (Model B)** — Predicts circuit-level ignition spike risk over 24h/48h/72h horizons.
   - Parameters: circuit_id, horizon_hours (24/48/72), psa_id, min_prob (0-1), risk_band (LOW/MODERATE/HIGH/CRITICAL), prediction_date, limit

3. **Fire Spread & Behavior Model (Model C)** — Predicts fire spread rate (chains/hr), flame length (ft), and spotting distance (mi) using wind, terrain, and fuel moisture data.
   - Parameters: circuit_id, psa_id, min_spread (chains/hr), severity (LOW/MODERATE/HIGH/EXTREME), prediction_date, limit

4. **Customer Density** — Shows how many customers (total and critical/medical-baseline) are on each circuit, with current ignition risk overlay.
   - Parameters: circuit_id, psa_id, risk_band (LOW/MODERATE/HIGH/CRITICAL), min_customers, limit

When users ask questions in natural language, use the appropriate tool to fetch predictions and then summarize the results clearly. Examples:
- "Which circuits are at critical risk?" → query_circuit_ignition_risk with risk_band=CRITICAL
- "What's the 72-hour risk for circuit C008?" → query_circuit_ignition_risk with circuit_id=C008, horizon_hours=72
- "Show me PSA risk for next month" → query_psa_risk with month_offset=1
- "Where is fire spreading fastest?" → query_fire_spread_risk sorted by spread rate
- "How many customers are affected by critical risk?" → query_customer_density with risk_band=CRITICAL
- "Show customer density for PSA_2" → query_customer_density with psa_id=PSA_2
- "Which circuits have the most customers at risk?" → query_customer_density sorted by customer_count
- "Are there medical baseline customers on high-risk circuits?" → query_customer_density with risk_band=HIGH (check critical_customers field)

Always present results in a clear, organized format with risk levels highlighted. When showing customer data, emphasize critical/medical-baseline customers. If no results are found, explain what that means.`;

const tools = [
  {
    type: "function",
    function: {
      name: "query_customer_density",
      description: "Query customer density per circuit with risk overlay. Shows how many customers (total and critical/medical-baseline) are on each circuit, optionally filtered by risk level or PSA.",
      parameters: {
        type: "object",
        properties: {
          circuit_id: { type: "string", description: "Filter by specific circuit ID (e.g. C008)" },
          psa_id: { type: "string", description: "Filter by PSA ID" },
          risk_band: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"], description: "Filter by current ignition risk band" },
          min_customers: { type: "number", description: "Minimum customer count threshold" },
          limit: { type: "number", description: "Max number of results" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_psa_risk",
      description: "Query PSA (Predictive Service Area) wildfire activity risk predictions over a 1-3 month horizon.",
      parameters: {
        type: "object",
        properties: {
          psa_id: { type: "string", description: "Filter by specific PSA ID (e.g. PSA_1)" },
          month_offset: { type: "number", enum: [1, 2, 3], description: "Month offset for prediction (1=next month, 2=2 months, 3=3 months)" },
          min_prob: { type: "number", description: "Minimum probability threshold (0-1)" },
          prediction_date: { type: "string", description: "Date for predictions (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max number of results" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_circuit_ignition_risk",
      description: "Query circuit-level ignition spike risk predictions for 24h, 48h, or 72h horizons.",
      parameters: {
        type: "object",
        properties: {
          circuit_id: { type: "string", description: "Filter by specific circuit ID (e.g. C008)" },
          horizon_hours: { type: "number", enum: [24, 48, 72], description: "Prediction horizon in hours" },
          psa_id: { type: "string", description: "Filter by PSA ID" },
          min_prob: { type: "number", description: "Minimum probability threshold (0-1)" },
          risk_band: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"], description: "Filter by risk band" },
          prediction_date: { type: "string", description: "Date for predictions (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max number of results" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_fire_spread_risk",
      description: "Query fire spread and behavior predictions including spread rate (chains/hr), flame length (ft), and spotting distance (mi).",
      parameters: {
        type: "object",
        properties: {
          circuit_id: { type: "string", description: "Filter by specific circuit ID (e.g. C008)" },
          psa_id: { type: "string", description: "Filter by PSA ID" },
          min_spread: { type: "number", description: "Minimum spread rate in chains/hr" },
          severity: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "EXTREME"], description: "Filter by spread severity" },
          prediction_date: { type: "string", description: "Date for predictions (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max number of results" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

async function callBackend(path: string, params: Record<string, any>): Promise<any> {
  const BACKEND_URL = Deno.env.get("BACKEND_API_URL");
  const BACKEND_KEY = Deno.env.get("BACKEND_API_KEY");

  if (!BACKEND_URL) throw new Error("BACKEND_API_URL not configured");

  const url = new URL(path, BACKEND_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      ...(BACKEND_KEY ? { "X-API-Key": BACKEND_KEY } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${path} responded ${res.status}: ${text}`);
  }
  return res.json();
}

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    let result: any;
    if (name === "query_customer_density") {
      result = await callBackend("/customer-density", args);
    } else if (name === "query_psa_risk") {
      result = await callBackend("/psa-risk", args);
    } else if (name === "query_circuit_ignition_risk") {
      result = await callBackend("/circuit-ignition-risk", args);
    } else if (name === "query_fire_spread_risk") {
      result = await callBackend("/fire-spread-risk", args);
    } else {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
    return JSON.stringify(result);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // First call: let AI decide if it needs tools
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        tools,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstResult = await firstResponse.json();
    const choice = firstResult.choices?.[0];

    // If no tool calls, return the response directly
    if (!choice?.message?.tool_calls || choice.message.tool_calls.length === 0) {
      return new Response(JSON.stringify({ reply: choice?.message?.content || "I'm not sure how to help with that." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute tool calls
    const toolResults = [];
    for (const tc of choice.message.tool_calls) {
      const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      const result = await executeTool(tc.function.name, args);
      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Second call: let AI summarize results with streaming (no tools — just summarize)
    const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          ...allMessages,
          choice.message,
          ...toolResults,
          { role: "system", content: "Summarize the tool results for the user in a clear, formatted way. Do NOT call any more tools." },
        ],
        tools,
        tool_choice: "none",
        stream: true,
      }),
    });

    if (!secondResponse.ok) {
      const t = await secondResponse.text();
      console.error("AI second call error:", secondResponse.status, t);
      return new Response(JSON.stringify({ error: "AI service error during summarization" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(secondResponse.body, {
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

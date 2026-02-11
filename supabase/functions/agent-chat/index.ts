import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const agentSystemPrompt = `You help utility AGENTS serving customers in wildfire-prone areas of California.

You are an internal tool for call-center agents — NOT a customer-facing chatbot. Your responses should help the agent handle customer interactions professionally and efficiently.

AGENT REQUESTS YOU HANDLE:
- "Draft response to [customer complaint]"
- "Explain [topic] for customer call"
- "Suggest assistance programs"
- "PSPS talking points"
- General questions about utility policies, wildfire safety, billing, and grid operations

ALWAYS respond with two clearly labeled sections:

📝 **Customer Response** (copy-paste ready text the agent can read or send to the customer)

💡 **Agent Notes** (internal context: why this response works, what to watch for, escalation triggers)

STYLE:
- Customer Response section: empathetic, clear, non-technical, actionable
- Agent Notes section: concise, direct, technical details OK
- Use bullet points for clarity
- Reference specific programs (REACH, Match My Payment, PSPS, EPSS, DLR) when relevant
- If the customer has arrears, always mention assistance options in the response
- If wildfire risk is High, always include safety information`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, customerContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemMessages = [
      { role: "system", content: agentSystemPrompt },
    ];
    if (customerContext) {
      systemMessages.push({ role: "system", content: customerContext });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [...systemMessages, ...messages],
          stream: true,
        }),
      }
    );

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
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

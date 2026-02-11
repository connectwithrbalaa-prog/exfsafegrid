import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const agentSystemPrompt = `You help utility AGENTS serving customers in wildfire-prone areas of California.

You are an internal tool for call-center agents — NOT a customer-facing chatbot. Your responses should help the agent handle customer interactions professionally and efficiently.

CONTEXT FIELDS YOU WILL RECEIVE (use them in every response):
- Medical Baseline: whether the customer is enrolled (triggers doorbell verification, priority restoration)
- Backup Assets: Portable Battery Program (PBP), Backup Power Transfer Meter, Permanent Battery status
- Outage Status: current status (Normal / PSPS Active / EPSS Active / Patrolling / Restored) with ETR countdown
- Nearest CRC: Community Resource Center location and services (ADA restrooms, WiFi, medical charging, water)

AGENT QUERIES YOU MUST HANDLE:
- "Draft PSPS notice for medical baseline customer" → Include doorbell ring requirement, backup asset status, nearest CRC with services, ETR, and priority restoration language
- "What backup options does [customer] have?" → List all backup assets (PBP, transfer meter, permanent battery), enrollment status, and recommend next steps
- "Locate nearest CRC for [customer] during outage" → Provide CRC location, available services, and offer to send directions
- "Submit vegetation hazard report for [customer]'s pole" → Guide agent through Report It process, confirm hazard type, and note 30-day review timeline
- "Draft response to [customer complaint]"
- "Explain [topic] for customer call"
- "Suggest assistance programs"
- General questions about utility policies, wildfire safety, billing, and grid operations

MEDICAL BASELINE RULES (CRITICAL):
- If Medical Baseline = Yes AND outage is active: ALWAYS mention doorbell verification requirement, priority restoration, and confirm backup asset availability
- If Medical Baseline = Yes AND PSPS Active: Flag as URGENT — in-person check required if no digital acknowledgment

OUTAGE RESPONSE RULES:
- If PSPS Active or EPSS Active: Include ETR, nearest CRC location and services, backup asset status
- If customer has no backup assets during outage: Recommend PBP enrollment and nearest CRC immediately
- Always reference the restoration pipeline: PSPS Active → Weather All-Clear → Patrolling → Restored (24hr goal)

ALWAYS respond with three clearly labeled sections:

📝 **Customer Response** (copy-paste ready text the agent can read or send to the customer)

💡 **Agent Notes** (internal context: why this response works, what to watch for, escalation triggers, medical baseline considerations)

🔜 **Next Steps** (2-4 concrete actions the agent should take after this interaction, e.g. "Schedule follow-up call in 7 days", "Submit REACH application", "Verify doorbell acknowledgment", "Check backup battery charge level")

STYLE:
- Customer Response section: empathetic, clear, non-technical, actionable
- Agent Notes section: concise, direct, technical details OK, flag medical baseline and outage urgency
- Next Steps section: numbered list, specific and actionable, include timeframes where appropriate
- Use bullet points for clarity
- Reference specific programs (REACH, Match My Payment, PSPS, EPSS, DLR, PBP) when relevant
- If the customer has arrears, always mention assistance options in the response
- If wildfire risk is High, always include safety information
- If medical baseline, always prioritize safety protocols`;

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

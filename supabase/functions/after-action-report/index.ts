/**
 * after-action-report — AI-powered post-event report generator
 *
 * POST body: { event_id: string }
 *
 * Flow:
 *   1. Fetch psps_events row by event_id
 *   2. Fetch related hazard_reports filed during the event window
 *   3. Fetch sms_log stats for this event (alerts sent, replies, help flags)
 *   4. Build a structured prompt and call the AI gateway (Gemini / Claude)
 *   5. Return { report: string } — 5-section narrative
 *
 * The report format follows CPUC post-event filing requirements:
 *   - Executive Summary
 *   - Event Timeline
 *   - Customer Impact & Outreach
 *   - Field Crew & Operations
 *   - Compliance & Regulatory Notes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { event_id } = await req.json();
  if (!event_id) {
    return new Response(
      JSON.stringify({ error: "event_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Fetch event
  const { data: event, error: eventErr } = await supabase
    .from("psps_events")
    .select("*")
    .eq("event_id", event_id)
    .single();

  if (eventErr || !event) {
    return new Response(
      JSON.stringify({ error: `Event ${event_id} not found` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Fetch hazard reports during event window
  const { data: hazards } = await supabase
    .from("hazard_reports")
    .select("hazard_type, description, latitude, longitude, created_at")
    .gte("created_at", event.start_time)
    .lte("created_at", event.end_time ?? new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  // 3. Fetch SMS stats for this time window
  const { data: smsRows } = await supabase
    .from("sms_log")
    .select("status, reply_type, alert_type")
    .gte("sent_at", event.start_time)
    .lte("sent_at", event.end_time ?? new Date().toISOString());

  const smsSent      = smsRows?.filter(r => r.status !== "deduped").length ?? 0;
  const smsHelp      = smsRows?.filter(r => r.reply_type === "HELP").length ?? 0;
  const smsConfirm   = smsRows?.filter(r => r.reply_type === "CONFIRM").length ?? 0;
  const smsDeduped   = smsRows?.filter(r => r.status === "deduped").length ?? 0;

  const durationH = event.end_time
    ? ((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 3600000).toFixed(1)
    : "Ongoing";

  const hazardSummary = (hazards ?? [])
    .map(h => `  - [${new Date(h.created_at).toLocaleTimeString()}] ${h.hazard_type}: ${h.description}`)
    .join("\n");

  const prompt = `You are a utility regulatory analyst. Generate a formal PSPS After-Action Report
for submission to the California Public Utilities Commission (CPUC).

EVENT DATA:
  Event ID:            ${event.event_id}
  Event Name:          ${event.event_name}
  Region:              ${event.region}
  Start Time:          ${new Date(event.start_time).toLocaleString()}
  End Time:            ${event.end_time ? new Date(event.end_time).toLocaleString() : "Ongoing"}
  Duration:            ${durationH} hours
  Affected Customers:  ${event.affected_customers}
  Medical Baseline:    ${event.medical_baseline}
  Crew Deployments:    ${event.crew_deployments}
  CRC Staffed:         ${event.crc_staffed ? "Yes" : "No"}
  SLA Breaches:        ${event.sla_breaches?.join("; ") || "None"}
  PSPS Phase:          De-energization → Patrol → Restoration

SMS ALERT STATS:
  Total Sent:          ${smsSent}
  CONFIRM Replies:     ${smsConfirm}
  HELP Escalations:    ${smsHelp}
  Deduped (blocked):   ${smsDeduped}

HAZARD REPORTS FILED (${hazards?.length ?? 0} total):
${hazardSummary || "  None filed during event window"}

Generate the report in exactly these 5 sections with clear headers:

## Executive Summary
## Event Timeline
## Customer Impact & Outreach
## Field Crew & Operations
## Compliance & Regulatory Notes

Use professional regulatory language. Include specific numbers from the data above.
Note whether CPUC notification SLAs were met (24h advance notice, 4h medical baseline contact).
End with a Regulatory Submission Checklist.`;

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
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    return new Response(
      JSON.stringify({ error: "AI generation failed", details: errText }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = await response.json();
  const report = result.choices?.[0]?.message?.content ?? "Report generation failed";

  return new Response(
    JSON.stringify({ report, event_id, generated_at: new Date().toISOString() }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

/**
 * sms-send — Two-Way SMS dispatch via Twilio with deduplication
 *
 * POST body:
 *   { to, message, alert_type, zip_code, customer_id? }
 *
 * Dedup rule: if the same zip_code+alert_type already has a non-deduped
 * record within the past 60 minutes, the new send is blocked and logged
 * as status="deduped". This prevents alert fatigue.
 *
 * Inbound webhook (Twilio → /sms-send?_action=reply):
 *   Twilio POST with From, Body → parsed for CONFIRM/HELP/STOP keywords,
 *   sms_log row updated with reply + reply_type.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseReplyType(body: string): "CONFIRM" | "HELP" | "STOP" | "CUSTOM" {
  const b = body.trim().toUpperCase();
  if (b === "CONFIRM" || b === "YES" || b === "OK") return "CONFIRM";
  if (b === "STOP" || b === "UNSUBSCRIBE" || b === "CANCEL") return "STOP";
  if (b.startsWith("HELP") || b.includes("HELP")) return "HELP";
  return "CUSTOM";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  // ── Inbound Twilio webhook (CONFIRM / HELP / STOP replies) ──
  if (url.searchParams.get("_action") === "reply") {
    const formData = await req.formData();
    const from    = formData.get("From")?.toString() ?? "";
    const body    = formData.get("Body")?.toString() ?? "";
    const replyType = parseReplyType(body);

    // Find the most recent sms_log row for this phone number
    const { data: rows } = await supabase
      .from("sms_log")
      .select("id")
      .eq("phone", from)
      .order("sent_at", { ascending: false })
      .limit(1);

    if (rows && rows.length > 0) {
      await supabase
        .from("sms_log")
        .update({
          status:     "replied",
          reply:      body,
          reply_type: replyType,
          reply_at:   new Date().toISOString(),
        })
        .eq("id", rows[0].id);
    }

    // Twilio expects TwiML response (empty is fine to suppress auto-reply)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }

  // ── Outbound send ────────────────────────────────────────────
  const { to, message, alert_type, zip_code, customer_id } = await req.json();

  if (!to || !message || !alert_type) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, message, alert_type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Dedup check: same ZIP + type within the last 60 minutes
  if (zip_code) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("sms_log")
      .select("id")
      .eq("zip_code", zip_code)
      .eq("alert_type", alert_type)
      .gte("sent_at", since)
      .neq("status", "deduped")
      .limit(1);

    if (recent && recent.length > 0) {
      await supabase.from("sms_log").insert({
        customer_id: customer_id ?? null,
        zip_code,
        phone:      to,
        message,
        alert_type,
        status:     "deduped",
      });
      return new Response(
        JSON.stringify({ deduped: true, reason: "Duplicate alert within 60-minute window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Send via Twilio REST API
  const TWILIO_SID   = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM  = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    // Graceful fallback: log as "sent" so UI can be tested without Twilio configured
    console.warn("Twilio credentials not configured — logging without sending");
    await supabase.from("sms_log").insert({
      customer_id: customer_id ?? null,
      zip_code:    zip_code ?? null,
      phone:       to,
      message,
      alert_type,
      status:      "sent",
    });
    return new Response(
      JSON.stringify({ ok: true, simulated: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const twilioBody = new URLSearchParams({
    To:   to,
    From: TWILIO_FROM,
    Body: message,
  });

  const twilioResp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    }
  );

  const twilioData = await twilioResp.json();
  const status     = twilioResp.ok ? "sent" : "failed";

  await supabase.from("sms_log").insert({
    customer_id: customer_id ?? null,
    zip_code:    zip_code ?? null,
    phone:       to,
    message,
    alert_type,
    status,
  });

  return new Response(
    JSON.stringify({
      ok:     twilioResp.ok,
      status,
      sid:    twilioData.sid ?? null,
      error:  twilioResp.ok ? null : twilioData.message,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

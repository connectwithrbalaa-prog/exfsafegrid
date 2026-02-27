import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { customer_ids, template_id, channel, custom_message } = await req.json();

    if (!customer_ids?.length) {
      return new Response(JSON.stringify({ error: "customer_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve template message
    const templates = getTemplates();
    const template = templates.find((t: any) => t.id === template_id);
    const message = custom_message || template?.body || "No message provided";
    const notificationType = template?.type || "watch";

    // Insert notification records (mock delivery)
    const rows = customer_ids.map((cid: string) => ({
      customer_id: cid,
      type: notificationType,
      channel: channel || "sms",
      status: "sent",
      message,
    }));

    const { data, error } = await supabase
      .from("customer_notifications")
      .insert(rows)
      .select();

    if (error) throw error;

    // In production, this is where Twilio/SendGrid calls would happen.
    // For now we simulate delivery by updating status after a short delay concept.
    // The records are already inserted with status "sent".

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: data.length,
        delivery_mode: "mock",
        notifications: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notifications-send error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getTemplates() {
  return [
    {
      id: "psps-watch",
      type: "watch",
      name: "PSPS Watch Notice",
      body: "⚠️ PSPS Watch: Your area may experience a planned power shutoff in the next 48-72 hours due to elevated fire weather conditions. We will notify you with updates. Reply HELP for assistance.",
      channels: ["sms", "email", "voice"],
    },
    {
      id: "psps-warning",
      type: "warning",
      name: "PSPS Warning Notice",
      body: "🔴 PSPS Warning: A planned power shutoff is imminent for your area. Please prepare by charging devices, filling prescriptions, and identifying your nearest Community Resource Center. Reply CONFIRM to acknowledge.",
      channels: ["sms", "email", "voice"],
    },
    {
      id: "psps-shutoff",
      type: "shutoff",
      name: "PSPS Shutoff Notice",
      body: "⛔ Power Shutoff Active: Your power has been turned off as part of a Public Safety Power Shutoff. Visit your nearest CRC for charging and supplies. Call 811 for emergencies. We will notify you when restoration begins.",
      channels: ["sms", "email", "voice"],
    },
    {
      id: "psps-restoration",
      type: "restoration",
      name: "Restoration Notice",
      body: "✅ Power Restored: Your power has been restored. If you are still experiencing an outage, please call our support line. Thank you for your patience during this safety event.",
      channels: ["sms", "email"],
    },
    {
      id: "fire-proximity",
      type: "warning",
      name: "Fire Proximity Alert",
      body: "🔥 Fire Alert: An active wildfire has been detected near your area. Stay informed and be prepared to evacuate if directed by local authorities. Monitor local news for updates.",
      channels: ["sms", "email", "voice"],
    },
    {
      id: "medical-baseline",
      type: "watch",
      name: "Medical Baseline Priority",
      body: "🏥 Medical Baseline Notice: As a Medical Baseline customer, you are receiving priority notification of potential service disruptions. Please ensure your backup power devices are charged and ready.",
      channels: ["sms", "email", "voice"],
    },
  ];
}

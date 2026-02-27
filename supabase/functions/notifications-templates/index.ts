const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const templates = [
    {
      id: "psps-watch",
      type: "watch",
      name: "PSPS Watch Notice",
      body: "⚠️ PSPS Watch: Your area may experience a planned power shutoff in the next 48-72 hours due to elevated fire weather conditions. We will notify you with updates. Reply HELP for assistance.",
      channels: ["sms", "email", "voice"],
      variables: ["customer_name", "zip_code", "estimated_start"],
    },
    {
      id: "psps-warning",
      type: "warning",
      name: "PSPS Warning Notice",
      body: "🔴 PSPS Warning: A planned power shutoff is imminent for your area. Please prepare by charging devices, filling prescriptions, and identifying your nearest Community Resource Center. Reply CONFIRM to acknowledge.",
      channels: ["sms", "email", "voice"],
      variables: ["customer_name", "zip_code", "shutoff_time"],
    },
    {
      id: "psps-shutoff",
      type: "shutoff",
      name: "PSPS Shutoff Notice",
      body: "⛔ Power Shutoff Active: Your power has been turned off as part of a Public Safety Power Shutoff. Visit your nearest CRC for charging and supplies. Call 811 for emergencies. We will notify you when restoration begins.",
      channels: ["sms", "email", "voice"],
      variables: ["customer_name", "crc_location"],
    },
    {
      id: "psps-restoration",
      type: "restoration",
      name: "Restoration Notice",
      body: "✅ Power Restored: Your power has been restored. If you are still experiencing an outage, please call our support line. Thank you for your patience during this safety event.",
      channels: ["sms", "email"],
      variables: ["customer_name"],
    },
    {
      id: "fire-proximity",
      type: "warning",
      name: "Fire Proximity Alert",
      body: "🔥 Fire Alert: An active wildfire has been detected near your area. Stay informed and be prepared to evacuate if directed by local authorities. Monitor local news for updates.",
      channels: ["sms", "email", "voice"],
      variables: ["customer_name", "fire_name", "distance_km"],
    },
    {
      id: "medical-baseline",
      type: "watch",
      name: "Medical Baseline Priority",
      body: "🏥 Medical Baseline Notice: As a Medical Baseline customer, you are receiving priority notification of potential service disruptions. Please ensure your backup power devices are charged and ready.",
      channels: ["sms", "email", "voice"],
      variables: ["customer_name"],
    },
  ];

  return new Response(JSON.stringify({ templates }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

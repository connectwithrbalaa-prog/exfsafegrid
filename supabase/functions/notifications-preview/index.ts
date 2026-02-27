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
    const { template_id, channel, variables } = await req.json();

    const templates: Record<string, { name: string; body: string; type: string }> = {
      "psps-watch": {
        name: "PSPS Watch Notice",
        type: "watch",
        body: "⚠️ PSPS Watch: Your area may experience a planned power shutoff in the next 48-72 hours due to elevated fire weather conditions. We will notify you with updates. Reply HELP for assistance.",
      },
      "psps-warning": {
        name: "PSPS Warning Notice",
        type: "warning",
        body: "🔴 PSPS Warning: A planned power shutoff is imminent for your area. Please prepare by charging devices, filling prescriptions, and identifying your nearest Community Resource Center. Reply CONFIRM to acknowledge.",
      },
      "psps-shutoff": {
        name: "PSPS Shutoff Notice",
        type: "shutoff",
        body: "⛔ Power Shutoff Active: Your power has been turned off as part of a Public Safety Power Shutoff. Visit your nearest CRC for charging and supplies. Call 811 for emergencies.",
      },
      "psps-restoration": {
        name: "Restoration Notice",
        type: "restoration",
        body: "✅ Power Restored: Your power has been restored. If you are still experiencing an outage, please call our support line. Thank you for your patience.",
      },
      "fire-proximity": {
        name: "Fire Proximity Alert",
        type: "warning",
        body: "🔥 Fire Alert: An active wildfire has been detected near your area. Stay informed and be prepared to evacuate if directed by local authorities.",
      },
      "medical-baseline": {
        name: "Medical Baseline Priority",
        type: "watch",
        body: "🏥 Medical Baseline Notice: As a Medical Baseline customer, you are receiving priority notification of potential service disruptions. Please ensure your backup power devices are charged.",
      },
    };

    const template = templates[template_id];
    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple variable interpolation
    let rendered = template.body;
    if (variables && typeof variables === "object") {
      for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
      }
    }

    // Channel-specific formatting
    let preview: any = { rendered_text: rendered };
    if (channel === "email") {
      preview = {
        subject: `ExfSafeGrid: ${template.name}`,
        html_body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1a1a2e;color:#e0e0e0;padding:16px 20px;border-radius:8px 8px 0 0;">
            <strong>ExfSafeGrid</strong> — ${template.name}
          </div>
          <div style="background:#ffffff;color:#333;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
            <p>${rendered}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
            <p style="font-size:11px;color:#999;">This is an automated notification from ExfSafeGrid. Do not reply to this email.</p>
          </div>
        </div>`,
        rendered_text: rendered,
      };
    } else if (channel === "voice") {
      preview = {
        tts_script: rendered.replace(/[⚠️🔴⛔✅🔥🏥]/g, "").trim(),
        rendered_text: rendered,
        estimated_duration_seconds: Math.ceil(rendered.length / 15),
      };
    }

    return new Response(JSON.stringify({
      template_id,
      template_name: template.name,
      channel: channel || "sms",
      ...preview,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

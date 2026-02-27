import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Same circuit data as frontend for re-simulation
const CIRCUITS = [
  { circuit_id: "SCE-001", customer_count: 3200, critical_customers: 45, hftd_tier: 3 },
  { circuit_id: "SCE-002", customer_count: 8500, critical_customers: 120, hftd_tier: 2 },
  { circuit_id: "SCE-003", customer_count: 1800, critical_customers: 22, hftd_tier: 3 },
  { circuit_id: "SCE-004", customer_count: 6200, critical_customers: 88, hftd_tier: 2 },
  { circuit_id: "SCE-005", customer_count: 4100, critical_customers: 55, hftd_tier: 2 },
  { circuit_id: "SCE-006", customer_count: 6800, critical_customers: 90, hftd_tier: 2 },
  { circuit_id: "PGE-001", customer_count: 5400, critical_customers: 72, hftd_tier: 2 },
  { circuit_id: "PGE-002", customer_count: 2900, critical_customers: 38, hftd_tier: 3 },
  { circuit_id: "PGE-003", customer_count: 2100, critical_customers: 65, hftd_tier: 3 },
  { circuit_id: "PGE-004", customer_count: 7200, critical_customers: 95, hftd_tier: 2 },
  { circuit_id: "PGE-005", customer_count: 1500, critical_customers: 18, hftd_tier: 3 },
  { circuit_id: "PGE-006", customer_count: 11200, critical_customers: 145, hftd_tier: 2 },
  { circuit_id: "PGE-007", customer_count: 4800, critical_customers: 60, hftd_tier: 2 },
  { circuit_id: "PGE-008", customer_count: 2200, critical_customers: 30, hftd_tier: 3 },
  { circuit_id: "PGE-009", customer_count: 3600, critical_customers: 48, hftd_tier: 2 },
  { circuit_id: "PGE-010", customer_count: 1200, critical_customers: 20, hftd_tier: 3 },
  { circuit_id: "SDGE-001", customer_count: 3800, critical_customers: 42, hftd_tier: 3 },
  { circuit_id: "SDGE-002", customer_count: 2600, critical_customers: 35, hftd_tier: 3 },
  { circuit_id: "SDGE-003", customer_count: 5100, critical_customers: 68, hftd_tier: 2 },
  { circuit_id: "SDGE-004", customer_count: 950, critical_customers: 15, hftd_tier: 3 },
];

function simulate(circuitIds: string[], horizon: number) {
  const selected = CIRCUITS.filter((c) => circuitIds.includes(c.circuit_id));
  if (selected.length === 0) return null;

  const totalCustomers = selected.reduce((s, c) => s + c.customer_count, 0);
  const critical = selected.reduce((s, c) => s + c.critical_customers, 0);
  const commercial = Math.round(totalCustomers * 0.18);
  const residential = totalCustomers - commercial - critical;
  const mwLost = Math.round(totalCustomers * 0.005 * 10) / 10;
  const avgHftd = selected.reduce((s, c) => s + c.hftd_tier, 0) / selected.length;
  const baseFactor = avgHftd >= 3 ? 1.4 : 1.0;
  const restorationHours = Math.round((horizon * 0.6 + selected.length * 1.5) * baseFactor);

  return { totalCustomers, residential, commercial, critical, mwLost, restorationHours };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { psps_event_id } = await req.json();
    if (!psps_event_id) {
      return new Response(JSON.stringify({ error: "psps_event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: event, error } = await sb
      .from("psps_events")
      .select("*")
      .eq("id", psps_event_id)
      .single();

    if (error || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-simulate with current model
    const newMetrics = simulate(event.circuit_ids, event.horizon_hours);

    // Generate comparison summary via Lovable AI
    let aiSummary = "";
    try {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey && newMetrics) {
        const prompt = `Compare these two PSPS de-energization impact assessments for the same circuits. 
Original event "${event.event_name}" (${event.event_date}):
- Customers: ${event.total_customers}, Critical: ${event.critical}, MW Lost: ${event.mw_lost}, Restoration: ${event.restoration_hours}h

Re-run with current network model:
- Customers: ${newMetrics.totalCustomers}, Critical: ${newMetrics.critical}, MW Lost: ${newMetrics.mwLost}, Restoration: ${newMetrics.restorationHours}h

Write a concise 2-3 sentence comparison summary highlighting key differences and what they mean for operational planning.`;

        const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiSummary = aiData.choices?.[0]?.message?.content || "";
        }
      }
    } catch {
      // AI summary is optional
    }

    return new Response(
      JSON.stringify({
        original: {
          totalCustomers: event.total_customers,
          residential: event.residential,
          commercial: event.commercial,
          critical: event.critical,
          mwLost: Number(event.mw_lost),
          restorationHours: event.restoration_hours,
          summary: event.summary,
        },
        rerun: newMetrics,
        aiSummary,
        event,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

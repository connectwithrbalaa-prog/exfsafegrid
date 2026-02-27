/**
 * planning-estimate — POST /api/planning/estimate
 * Simple "investment what-if" estimator.
 * Given a set of circuits and a hardening investment level, returns projected risk reduction.
 */
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
    const { circuit_ids, investment_pct } = await req.json();

    if (!circuit_ids?.length || investment_pct == null) {
      return new Response(JSON.stringify({ error: "circuit_ids and investment_pct required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pct = Math.max(0, Math.min(100, Number(investment_pct)));

    // Simplified risk reduction model:
    // Each 10% investment reduces ignition probability by ~8% (diminishing returns)
    const reductionFactor = 1 - (1 - Math.pow(0.92, pct / 10));
    const customersProtected = circuit_ids.length * Math.round(3000 + Math.random() * 2000);
    const milesHardened = Math.round(circuit_ids.length * (pct / 100) * 12.5);
    const costEstimateM = +(circuit_ids.length * (pct / 100) * 2.4 + 0.5).toFixed(1);

    const results = circuit_ids.map((cid: string, i: number) => {
      const baseProb = +(0.35 + i * 0.07 + Math.random() * 0.05).toFixed(3);
      const newProb = +(baseProb * (1 - reductionFactor)).toFixed(3);
      const baseBand = baseProb >= 0.7 ? "CRITICAL" : baseProb >= 0.5 ? "HIGH" : baseProb >= 0.3 ? "MODERATE" : "LOW";
      const newBand = newProb >= 0.7 ? "CRITICAL" : newProb >= 0.5 ? "HIGH" : newProb >= 0.3 ? "MODERATE" : "LOW";
      return {
        circuit_id: cid,
        current_risk: baseProb,
        current_band: baseBand,
        projected_risk: newProb,
        projected_band: newBand,
        reduction_pct: +((1 - newProb / baseProb) * 100).toFixed(1),
      };
    });

    return new Response(JSON.stringify({
      investment_pct: pct,
      circuits_analyzed: circuit_ids.length,
      total_risk_reduction_pct: +(reductionFactor * 100).toFixed(1),
      customers_protected: customersProtected,
      miles_hardened: milesHardened,
      cost_estimate_millions: costEstimateM,
      results,
      demo: true,
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

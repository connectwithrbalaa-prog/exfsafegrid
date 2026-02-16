import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FirePoint {
  latitude: number;
  longitude: number;
  frp: number;
  acq_date: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ZIP code approximate centroids for the service territory
const ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "93644": { lat: 37.28, lng: -119.55 },
  "93614": { lat: 37.14, lng: -119.69 },
  "93623": { lat: 37.46, lng: -119.64 },
  "93210": { lat: 36.13, lng: -120.36 },
  "93242": { lat: 36.31, lng: -119.88 },
  "93230": { lat: 36.33, lng: -119.39 },
  "93637": { lat: 37.10, lng: -119.77 },
  "93602": { lat: 37.06, lng: -119.51 },
  "93604": { lat: 37.48, lng: -119.56 },
  "93654": { lat: 36.63, lng: -119.34 },
  "93667": { lat: 36.81, lng: -119.33 },
  "93651": { lat: 36.80, lng: -119.40 },
};

interface ThresholdConfig {
  critical_km: number;
  high_km: number;
  medium_km: number;
}

const THRESHOLDS: ThresholdConfig = { critical_km: 10, high_km: 20, medium_km: 40 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { fires, manual, manualMessage, manualZips, manualSeverity } = body as {
      fires?: FirePoint[];
      manual?: boolean;
      manualMessage?: string;
      manualZips?: string[];
      manualSeverity?: string;
    };

    // Manual alert from agent
    if (manual && manualMessage && manualZips?.length) {
      const { data: subs } = await supabase
        .from("alert_subscribers")
        .select("*")
        .in("zip_code", manualZips)
        .eq("is_active", true);

      const recipientCount = subs?.length || 0;

      const { data: alert } = await supabase.from("community_alerts").insert({
        alert_type: "manual",
        severity: manualSeverity || "warning",
        title: "Manual Community Alert",
        message: manualMessage,
        affected_zips: manualZips,
        recipients_count: recipientCount,
        delivery_status: recipientCount > 0 ? "delivered" : "no_recipients",
      }).select().single();

      console.log(`Manual alert sent to ${recipientCount} subscribers in ZIPs: ${manualZips.join(", ")}`);

      return new Response(JSON.stringify({
        alert,
        recipients: recipientCount,
        channels: { email: subs?.filter(s => s.preferred_channel === "email").length || 0, sms: subs?.filter(s => s.preferred_channel === "sms").length || 0 },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Automated proximity check
    if (!fires || fires.length === 0) {
      return new Response(JSON.stringify({ alerts: [], message: "No fires provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alerts: any[] = [];

    for (const [zip, centroid] of Object.entries(ZIP_CENTROIDS)) {
      let closestDist = Infinity;
      let closestFire: FirePoint | null = null;

      for (const fire of fires) {
        const d = haversineKm(centroid.lat, centroid.lng, fire.latitude, fire.longitude);
        if (d < closestDist) {
          closestDist = d;
          closestFire = fire;
        }
      }

      if (!closestFire || closestDist > THRESHOLDS.medium_km) continue;

      const severity = closestDist <= THRESHOLDS.critical_km ? "critical"
        : closestDist <= THRESHOLDS.high_km ? "high" : "warning";

      const distMi = Math.round(closestDist * 0.621371);
      const message = severity === "critical"
        ? `CRITICAL: Active wildfire detected ${distMi} miles from ZIP ${zip}. Prepare for potential evacuation. Monitor local authorities for updates.`
        : severity === "high"
        ? `HIGH ALERT: Wildfire activity detected ${distMi} miles from ZIP ${zip}. Stay vigilant and prepare an evacuation plan.`
        : `ADVISORY: Wildfire monitoring active — fire detected ${distMi} miles from ZIP ${zip}. No immediate action required.`;

      const { data: subs } = await supabase
        .from("alert_subscribers")
        .select("*")
        .eq("zip_code", zip)
        .eq("is_active", true);

      const recipientCount = subs?.length || 0;

      const { data: alert } = await supabase.from("community_alerts").insert({
        alert_type: "fire_proximity",
        severity,
        title: `Fire Proximity Alert — ZIP ${zip}`,
        message,
        affected_zips: [zip],
        fire_distance_km: Math.round(closestDist * 10) / 10,
        fire_latitude: closestFire.latitude,
        fire_longitude: closestFire.longitude,
        recipients_count: recipientCount,
        delivery_status: recipientCount > 0 ? "delivered" : "no_recipients",
      }).select().single();

      alerts.push({ alert, zip, severity, distanceMi: distMi, recipients: recipientCount });
    }

    console.log(`Proximity check: ${alerts.length} alerts generated`);

    return new Response(JSON.stringify({ alerts, total: alerts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("community-alerts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { Zap, AlertTriangle, ShieldCheck, MapPin, Clock, List } from "lucide-react";
import type { Customer } from "@/lib/customer-types";
import { usePspsWatchlist } from "@/hooks/use-backend-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  customer: Customer;
}

const PHASE_LABELS = ["Forecast", "Activation", "All-Clear", "Patrolling", "Restored"];

function phaseIndex(phase: string): number {
  const map: Record<string, number> = {
    "weather forecast": 0, "psps activation": 1, "weather all-clear": 2,
    "patrolling": 3, "100% restored": 4, "restored": 4,
  };
  return map[phase.toLowerCase()] ?? 0;
}

/** Derive a PSPS likelihood from customer risk signals */
function derivePspsLikelihood(customer: Customer): { level: "HIGH" | "MEDIUM" | "LOW"; factors: string[] } {
  const risk = customer.wildfire_risk.toLowerCase();
  const tier = customer.hftd_tier.toLowerCase();
  const stress = customer.grid_stress_level.toLowerCase();
  const factors: string[] = [];

  if (risk === "high") factors.push("Wildfire Risk: High");
  else if (risk === "medium") factors.push("Wildfire Risk: Medium");

  if (tier.includes("3")) factors.push("HFTD Tier 3");
  else if (tier.includes("2")) factors.push("HFTD Tier 2");

  if (stress === "high") factors.push("Grid Stress: High");
  else if (stress === "medium") factors.push("Grid Stress: Medium");

  if (customer.current_outage_status !== "Normal") factors.push(`Outage: ${customer.current_outage_status}`);

  if ((risk === "high" && tier.includes("3")) || stress === "high") return { level: "HIGH", factors };
  if (risk === "medium" || tier.includes("2") || stress === "medium") return { level: "MEDIUM", factors };
  if (factors.length === 0) factors.push("No elevated risk factors");
  return { level: "LOW", factors };
}

const LIKELIHOOD_CFG: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/25" },
  MEDIUM: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/25" },
  LOW: { bg: "bg-success/10", text: "text-success", border: "border-success/25" },
};

/** Estimate a plausible outage window based on phase & grid stress */
function estimateOutageWindow(customer: Customer): string | null {
  if (customer.current_outage_status === "Normal" && customer.psps_phase === "Restored") return null;
  const stress = customer.grid_stress_level.toLowerCase();
  if (stress === "high") return "14:00 – 22:00";
  if (stress === "medium") return "16:00 – 20:00";
  return "18:00 – 21:00";
}

export default function PspsImpactCard({ customer }: Props) {
  const isActive = customer.current_outage_status !== "Normal" || customer.psps_phase !== "Restored";
  const phase = phaseIndex(customer.psps_phase);
  const hasEtr = customer.restoration_timer && customer.restoration_timer !== "TBD";
  const inHftd = customer.hftd_tier !== "None";
  const { level: likelihood, factors: likelihoodFactors } = derivePspsLikelihood(customer);
  const lCfg = LIKELIHOOD_CFG[likelihood];
  const outageWindow = estimateOutageWindow(customer);

  // Check if customer circuit is on the PSPS watchlist
  const { data: watchlist } = usePspsWatchlist({ horizon: "24h" });
  const onWatchlist = watchlist?.circuits
    ? (watchlist.circuits as any[]).some((c: any) => c.circuit_id?.includes(customer.zip_code.slice(-4)))
    : isActive; // fallback: treat active events as "on watchlist"

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <Zap className={`w-4 h-4 ${isActive ? "text-warning" : "text-primary"}`} />
          <h3 className="text-sm font-semibold text-card-foreground">PSPS Impact</h3>
        </div>
        {isActive ? (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-warning/12 text-warning border border-warning/25">
            ACTIVE
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-success/12 text-success border border-success/25">
            CLEAR
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* HFTD + Likelihood Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-medium">In HFTD?</p>
            </div>
            <p className={`text-sm font-bold mt-1 ${inHftd ? "text-warning" : "text-success"}`}>
              {inHftd ? `Yes — ${customer.hftd_tier}` : "No"}
            </p>
          </div>
          <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-medium">PSPS Likelihood (24h)</p>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded cursor-help ${lCfg.bg} ${lCfg.text} border ${lCfg.border}`}>
                    {likelihood}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] space-y-1 p-3">
                  <p className="text-[11px] font-semibold text-popover-foreground">Contributing Factors</p>
                  <ul className="space-y-0.5">
                    {likelihoodFactors.map((f) => (
                      <li key={f} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lCfg.bg.replace('/10', '')}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Outage Window + Watchlist Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-medium">Expected Outage Window</p>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={`text-sm font-bold mt-1 cursor-help ${outageWindow ? "text-card-foreground" : "text-muted-foreground"}`}>
                    {outageWindow ?? "N/A"}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] space-y-1.5 p-3">
                  <p className="text-[11px] font-semibold text-popover-foreground">How This Is Estimated</p>
                  <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground" />
                      Grid Stress: {customer.grid_stress_level}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground" />
                      {customer.grid_stress_level === "High"
                        ? "High stress → wider window (14:00–22:00)"
                        : customer.grid_stress_level === "Medium"
                          ? "Medium stress → moderate window (16:00–20:00)"
                          : "Low stress → narrow window (18:00–21:00)"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground" />
                      {outageWindow ? "Based on peak fire-weather hours" : "No active event — no window projected"}
                    </li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-1.5">
              <List className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-medium">On Watchlist?</p>
            </div>
            <p className={`text-sm font-bold mt-1 ${onWatchlist ? "text-warning" : "text-success"}`}>
              {onWatchlist ? "Yes" : "No"}
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Outage Status" value={customer.current_outage_status}
            color={customer.current_outage_status === "Normal" ? "text-success" : "text-warning"}
            icon="🟢" active={customer.current_outage_status !== "Normal"} />
          <MetricCard label="Current Phase" value={customer.psps_phase}
            color={phase >= 4 ? "text-success" : phase >= 2 ? "text-info" : "text-warning"}
            icon={phase >= 4 ? "✅" : "⏳"} />
          <MetricCard label="ETR" value={hasEtr ? customer.restoration_timer : "Not Set"}
            color={hasEtr ? "text-card-foreground" : "text-muted-foreground"}
            icon="🕐" />
          <MetricCard label="Digital ACK" value={customer.digital_ack_status}
            color={customer.digital_ack_status === "Confirmed" ? "text-success" : "text-warning"}
            icon={customer.digital_ack_status === "Confirmed" ? "✅" : "⏳"} />
        </div>

        {/* Phase Progress */}
        {isActive && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Event Timeline</p>
            <div className="flex gap-1">
              {PHASE_LABELS.map((label, i) => (
                <div key={label} className="flex-1 space-y-1">
                  <div className={`h-2 rounded-full transition-colors ${
                    i <= phase
                      ? i === phase ? "bg-primary" : "bg-primary/60"
                      : "bg-muted"
                  }`} />
                  <p className={`text-[9px] text-center leading-tight ${
                    i <= phase ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}>{label}</p>
                </div>
              ))}
            </div>
            {customer.patrolling_progress > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${customer.patrolling_progress}%` }} />
                </div>
                <span className="text-xs font-semibold text-card-foreground">{customer.patrolling_progress}%</span>
              </div>
            )}
          </div>
        )}

        {/* No active event */}
        {!isActive && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/5 border border-success/15">
            <ShieldCheck className="w-5 h-5 text-success" />
            <div>
              <p className="text-xs font-semibold text-success">No Active PSPS Event</p>
              <p className="text-[10px] text-success/70 mt-0.5">Power service operating normally</p>
            </div>
          </div>
        )}

        {/* Medical baseline doorbell alert */}
        {customer.medical_baseline && isActive && customer.digital_ack_status !== "Confirmed" && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-destructive">Doorbell Verification Needed</p>
              <p className="text-[10px] text-destructive/70 mt-0.5">Medical Baseline customer — safety protocol required</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, icon, active }: { label: string; value: string; color?: string; icon: string; active?: boolean }) {
  return (
    <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{active ? "🟡" : icon}</span>
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      </div>
      <p className={`text-sm font-bold mt-1 ${color ?? "text-card-foreground"}`}>{value}</p>
    </div>
  );
}

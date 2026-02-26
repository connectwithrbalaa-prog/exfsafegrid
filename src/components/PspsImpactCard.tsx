import { Zap, Clock, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Customer } from "@/lib/customer-types";

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

export default function PspsImpactCard({ customer }: Props) {
  const isActive = customer.current_outage_status !== "Normal" || customer.psps_phase !== "Restored";
  const phase = phaseIndex(customer.psps_phase);
  const hasEtr = customer.restoration_timer && customer.restoration_timer !== "TBD";

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
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Outage Status" value={customer.current_outage_status}
            color={customer.current_outage_status === "Normal" ? "text-success" : "text-warning"}
            icon={customer.current_outage_status === "Normal" ? "🟢" : "🟡"} />
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

function MetricCard({ label, value, color, icon }: { label: string; value: string; color?: string; icon: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{icon}</span>
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      </div>
      <p className={`text-sm font-bold mt-1 ${color ?? "text-card-foreground"}`}>{value}</p>
    </div>
  );
}

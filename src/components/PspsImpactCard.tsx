import { Zap, Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Customer } from "@/lib/customer-types";

interface Props {
  customer: Customer;
}

const PHASE_LABELS = [
  "Weather Forecast",
  "PSPS Activation",
  "Weather All-Clear",
  "Patrolling",
  "100% Restored",
];

function phaseIndex(phase: string): number {
  const idx = PHASE_LABELS.findIndex((p) => p.toLowerCase() === phase.toLowerCase());
  return idx >= 0 ? idx : 0;
}

export default function PspsImpactCard({ customer }: Props) {
  const isActive = customer.current_outage_status !== "Normal" || customer.psps_phase !== "Restored";
  const phase = phaseIndex(customer.psps_phase);
  const hasEtr = customer.restoration_timer && customer.restoration_timer !== "TBD";

  return (
    <div className={`p-4 rounded-lg border bg-card space-y-3 ${
      isActive ? "border-warning/50" : "border-border"
    }`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Zap className={`w-4 h-4 ${isActive ? "text-warning" : "text-muted-foreground"}`} />
          PSPS Impact
        </h3>
        {isActive ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
            ACTIVE
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
            CLEAR
          </span>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricRow icon={AlertTriangle} label="Outage Status" value={customer.current_outage_status}
          color={customer.current_outage_status === "Normal" ? "text-success" : "text-warning"} />
        <MetricRow icon={Zap} label="Phase" value={customer.psps_phase}
          color={phase >= 4 ? "text-success" : phase >= 2 ? "text-info" : "text-warning"} />
        <MetricRow icon={Clock} label="ETR" value={hasEtr ? customer.restoration_timer : "—"}
          color={hasEtr ? "text-card-foreground" : "text-muted-foreground"} />
        <MetricRow icon={CheckCircle2} label="Digital ACK" value={customer.digital_ack_status}
          color={customer.digital_ack_status === "Confirmed" ? "text-success" : "text-warning"} />
      </div>

      {/* Phase progress */}
      {isActive && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Event Phase</p>
          <div className="flex gap-1">
            {PHASE_LABELS.map((label, i) => (
              <div key={label} className="flex-1 space-y-0.5">
                <div className={`h-1.5 rounded-full ${i <= phase ? "bg-primary" : "bg-muted"}`} />
                <p className="text-[8px] text-muted-foreground text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
          {customer.patrolling_progress > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Patrolling: <span className="font-semibold text-card-foreground">{customer.patrolling_progress}%</span>
            </p>
          )}
        </div>
      )}

      {/* Doorbell alert for medical baseline */}
      {customer.medical_baseline && isActive && customer.digital_ack_status !== "Confirmed" && (
        <div className="flex items-center gap-2 p-2 rounded-md border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          <p className="text-[10px] font-bold text-destructive">Doorbell verification needed — Medical Baseline customer</p>
        </div>
      )}
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-xs font-semibold ${color ?? "text-card-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

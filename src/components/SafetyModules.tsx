import { useState, useEffect, useCallback } from "react";
import { Battery, BatteryCharging, Gauge, MapPin, Clock, Activity, CheckSquare, Plug, Send, ChevronDown, AlertTriangle, HeartPulse, Radio } from "lucide-react";
import type { Customer } from "@/lib/customer-types";
import { toast } from "sonner";

const PSPS_PHASES = ["Weather Forecast", "PSPS Activation", "Weather All-Clear", "Patrolling", "100% Restored"];

function phaseIndex(status: string): number {
  if (status === "Forecast") return 0;
  if (status === "Active" || status === "PSPS Active" || status === "EPSS Active") return 1;
  if (status === "All-Clear" || status === "Weather All-Clear") return 2;
  if (status === "Patrolling") return 3;
  if (status === "Restored" || status === "Normal") return 4;
  return 0;
}

/** Parse "X hours" or "X hours Y min" into total seconds */
function parseEtrToSeconds(etr: string): number | null {
  if (!etr || etr === "TBD" || etr === "N/A") return null;
  let total = 0;
  const hourMatch = etr.match(/(\d+)\s*h/i);
  const minMatch = etr.match(/(\d+)\s*m/i);
  if (hourMatch) total += parseInt(hourMatch[1]) * 3600;
  if (minMatch) total += parseInt(minMatch[1]) * 60;
  if (total === 0) {
    const numOnly = etr.match(/^(\d+)$/);
    if (numOnly) total = parseInt(numOnly[1]) * 3600;
  }
  return total > 0 ? total : null;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function useCountdown(etr: string, isActive: boolean) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    setRemaining(isActive ? parseEtrToSeconds(etr) : null);
  }, [etr, isActive]);
  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining !== null && remaining > 0]);
  return remaining;
}

function statusColor(status: string) {
  if (status === "PSPS Active" || status === "EPSS Active") return "text-destructive";
  if (status === "Patrolling") return "text-warning";
  if (status === "Restored" || status === "Normal") return "text-success";
  return "text-info";
}

function statusBg(status: string) {
  if (status === "PSPS Active" || status === "EPSS Active") return "bg-destructive/10 border-destructive/40";
  if (status === "Patrolling") return "bg-warning/10 border-warning/40";
  return "bg-muted/50 border-border";
}

export default function SafetyModules({ customer }: { customer: Customer }) {
  const isOutageActive = customer.current_outage_status !== "Normal";
  const remaining = useCountdown(customer.restoration_timer, isOutageActive);
  const currentPhase = phaseIndex(customer.psps_phase || customer.current_outage_status);
  const [patrolPct, setPatrolPct] = useState(customer.patrolling_progress ?? 0);
  const [doorbellStatus, setDoorbellStatus] = useState<string>(customer.doorbell_status || "Not Needed");
  const lastUpdate = customer.last_update ? new Date(customer.last_update).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* ===== PSPS EVENT TRACKER ===== */}
      <div className={`p-4 rounded-lg border-2 ${statusBg(customer.current_outage_status)} space-y-4`}>
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOutageActive ? "bg-destructive" : "bg-success"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOutageActive ? "bg-destructive" : "bg-success"}`} />
            </span>
            <h3 className="text-sm font-bold text-card-foreground">PSPS Event Tracker</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Updated {lastUpdate}</span>
        </div>

        {/* Customer + Circuit Info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-foreground">{customer.name}</span>
          <span className="text-muted-foreground">Circuit: <span className="font-mono font-medium text-foreground">HTD-{customer.zip_code.slice(-4)}</span></span>
          <span className="text-muted-foreground">ZIP: <span className="font-medium text-foreground">{customer.zip_code}</span></span>
          {customer.psps_event_id && <span className="text-muted-foreground">Event: <span className="font-mono font-medium text-foreground">{customer.psps_event_id}</span></span>}
        </div>

        {/* Live Status */}
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${statusColor(customer.current_outage_status)}`} />
          <span className={`text-sm font-bold ${statusColor(customer.current_outage_status)}`}>
            {customer.current_outage_status}
          </span>
        </div>

        {/* Phase Timeline */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Phase Timeline</p>
          <div className="flex items-center gap-0.5">
            {PSPS_PHASES.map((phase, i) => {
              const isComplete = i < currentPhase;
              const isCurrent = i === currentPhase;
              return (
                <div key={phase} className="flex-1 min-w-0">
                  <div className={`h-2 rounded-full transition-all ${isCurrent ? "bg-primary animate-pulse" : isComplete ? "bg-primary" : "bg-muted"}`} />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-0.5">
            {PSPS_PHASES.map((phase, i) => (
              <span key={phase} className={`flex-1 min-w-0 text-[8px] leading-tight truncate ${i === currentPhase ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {phase}
              </span>
            ))}
          </div>
        </div>

        {/* ETR + Progress Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-md bg-background/60 border border-border space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">⏱️ ETR Countdown</span>
              <button
                onClick={() => toast.info(`ETR updated for ${customer.name}`)}
                className="flex items-center gap-0.5 text-[9px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Update <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </div>
            {isOutageActive && remaining !== null && remaining > 0 ? (
              <p className="text-lg font-bold text-destructive font-mono tabular-nums flex items-center gap-1">
                <Clock className="w-4 h-4 animate-pulse" />
                {formatCountdown(remaining)}
              </p>
            ) : (
              <p className="text-lg font-bold text-foreground font-mono tabular-nums flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isOutageActive ? customer.restoration_timer : "—"}
              </p>
            )}
          </div>

          <div className="p-2.5 rounded-md bg-background/60 border border-border space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">📊 Patrolling</span>
              <button
                onClick={() => {
                  const next = Math.min(100, patrolPct + 5);
                  setPatrolPct(next);
                  toast.success(`Progress updated to ${next}%`);
                }}
                className="flex items-center gap-0.5 text-[9px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Update <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground font-mono tabular-nums">{patrolPct}%</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${patrolPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Medical Priority Row */}
        {customer.medical_baseline && isOutageActive && (
          <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10 space-y-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive">MEDICAL PRIORITY</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/20 text-destructive font-medium">
                🚨 Doorbell: {doorbellStatus}
              </span>
            </div>
            {doorbellStatus === "Pending" && (
              <button
                onClick={() => {
                  setDoorbellStatus("Dispatched");
                  toast.success(`Doorbell verification dispatched for ${customer.name}`);
                }}
                className="w-full text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity font-medium"
              >
                🔔 Dispatch Doorbell Verification
              </button>
            )}
          </div>
        )}

        {/* ===== ACTION PANEL ===== */}
        <div className="space-y-3 pt-1">
          {/* Row 1 — Urgent */}
          <div>
            <p className="text-[9px] font-semibold text-destructive uppercase tracking-wider mb-1.5">🚨 Urgent</p>
            <div className="grid grid-cols-3 gap-1.5">
              <ActionBtn emoji="📨" label="Send PSPS Notice" onClick={() => toast.success(`PSPS notice sent to ${customer.name}`)} variant="destructive" />
              <ActionBtn emoji="✅" label="Digital Ack Check" onClick={() => toast.info(`Checking digital acknowledgment for ${customer.name}…`)} variant="destructive" />
              <ActionBtn emoji="🔔" label="Doorbell Dispatch" onClick={() => { setDoorbellStatus("Dispatched"); toast.success(`Doorbell dispatched for ${customer.name}`); }} variant="destructive" />
            </div>
          </div>
          {/* Row 2 — Operations */}
          <div>
            <p className="text-[9px] font-semibold text-primary uppercase tracking-wider mb-1.5">🔋 Operations</p>
            <div className="grid grid-cols-3 gap-1.5">
              <ActionBtn emoji="🔋" label="Verify Backup" onClick={() => toast.info(`Backup verified for ${customer.name}`)} variant="primary" />
              <ActionBtn emoji="📍" label="Locate CRC" onClick={() => { navigator.clipboard.writeText(customer.nearest_crc_location || ""); toast.success(`CRC: ${customer.nearest_crc_location || "None"}`); }} variant="primary" />
              <ActionBtn emoji="⚡" label="Gen Alert" onClick={() => toast.success(`Generation alert sent for ${customer.name}`)} variant="primary" />
            </div>
          </div>
          {/* Row 3 — Case Management */}
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📋 Case Management</p>
            <div className="grid grid-cols-3 gap-1.5">
              <ActionBtn emoji="📝" label="Customer Notes" onClick={() => toast.info("Scroll to Agent Notes below")} variant="default" />
              <ActionBtn emoji="🔺" label="Escalate Priority" onClick={() => toast.warning(`Priority escalated for ${customer.name}`)} variant="default" />
              <ActionBtn emoji="✔️" label="Close Case" onClick={() => toast.success(`Case closed for ${customer.name}`)} variant="default" />
            </div>
          </div>
        </div>

        {/* ===== LIVE METRICS ===== */}
        <div className="p-3 rounded-md bg-background/60 border border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Metrics</p>
          <div className="space-y-1.5">
            <MetricRow label="Digital Notice Delivery" value="94%" detail="1,742 / 1,850" color="text-success" pct={94} />
            <MetricRow label="Doorbell Verifications" value="87%" detail="Complete" color="text-warning" pct={87} />
            <MetricRow label="CRC Check-ins" value="23" detail="customers" color="text-info" pct={46} />
          </div>
        </div>
      </div>

      {/* Backup Power Portfolio */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="w-4 h-4 text-info" />
          <h3 className="text-sm font-semibold text-card-foreground">Backup Power Assets</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <AssetRow checked={customer.has_portable_battery} label="Portable Battery Program (PBP)" />
          <AssetRow checked={customer.has_transfer_meter} label="Backup Power Transfer Meter" />
          <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
            <div className="flex items-center gap-2">
              <Battery className={`w-3.5 h-3.5 ${customer.has_permanent_battery !== "None" ? "text-success" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Permanent Battery</span>
            </div>
            <span className={`text-xs font-medium ${customer.has_permanent_battery !== "None" ? "text-success" : "text-muted-foreground"}`}>
              {customer.has_permanent_battery}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => toast.info(`Backup status for ${customer.name}: All systems nominal`)}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary font-medium transition-colors"
          >
            <Gauge className="w-3 h-3" />
            View Backup Status
          </button>
          <button
            onClick={() => toast.success(`Connection test sent to ${customer.name}'s backup systems`)}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-success/10 border border-success/30 hover:bg-success/20 text-success font-medium transition-colors"
          >
            <Plug className="w-3 h-3" />
            Test Connection
          </button>
        </div>
      </div>

      {/* Nearest CRC — prominent when power is off */}
      {customer.nearest_crc_location && isOutageActive && (
        <div className="p-4 rounded-lg border border-primary/50 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">📍 Nearest CRC</h3>
          </div>
          <p className="text-sm font-bold text-foreground">{customer.nearest_crc_location}</p>
          <div className="flex flex-wrap gap-2">
            {["♿ ADA Restrooms", "☕ WiFi", "⚡ Medical Charging", "💧 Water"].map((svc) => (
              <span key={svc} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted border border-border text-muted-foreground">
                {svc}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.nearest_crc_location || "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <MapPin className="w-3 h-3" />
              View Map
            </a>
            <button
              onClick={() => toast.success(`Directions sent to ${customer.name}`)}
              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition-colors"
            >
              <Send className="w-3 h-3" />
              Send Directions
            </button>
          </div>
          <div className="px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
            📍 {customer.nearest_crc_location}
          </div>
        </div>
      )}

      {/* CRC info when power is normal */}
      {customer.nearest_crc_location && !isOutageActive && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Nearest CRC</h3>
          </div>
          <p className="text-sm text-foreground mt-1.5">{customer.nearest_crc_location}</p>
        </div>
      )}
    </div>
  );
}

function AssetRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
      <div className="flex items-center gap-2">
        <CheckSquare className={`w-3.5 h-3.5 ${checked ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-xs font-medium ${checked ? "text-success" : "text-muted-foreground"}`}>
        {checked ? "Enrolled" : "None"}
      </span>
    </div>
  );
}

function ActionBtn({ emoji, label, onClick, variant }: { emoji: string; label: string; onClick: () => void; variant: "destructive" | "primary" | "default" }) {
  const styles = {
    destructive: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20 text-destructive",
    primary: "bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary",
    default: "bg-muted/50 border-border hover:bg-secondary text-foreground",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 text-[10px] px-1.5 py-1.5 rounded-md border font-medium transition-colors leading-tight text-center ${styles[variant]}`}
    >
      <span>{emoji}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function MetricRow({ label, value, detail, color, pct }: { label: string; value: string; detail: string; color: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground flex-shrink-0 w-[120px] truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color === "text-success" ? "bg-success" : color === "text-warning" ? "bg-warning" : "bg-info"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">({detail})</span>
    </div>
  );
}

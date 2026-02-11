import { useState, useEffect, useCallback } from "react";
import { Battery, BatteryCharging, Gauge, MapPin, Clock, Activity, CheckSquare, Plug, Send } from "lucide-react";
import type { Customer } from "@/lib/customer-types";
import { toast } from "sonner";

const OUTAGE_STAGES = ["PSPS Active", "Weather All-Clear", "Patrolling", "Restored"];

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
    if (numOnly) total = parseInt(numOnly[1]) * 3600; // assume hours
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
    const parsed = isActive ? parseEtrToSeconds(etr) : null;
    setRemaining(parsed);
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

function outageColor(status: string) {
  if (status === "PSPS Active" || status === "EPSS Active") return "text-destructive";
  if (status === "Patrolling") return "text-warning";
  if (status === "Restored") return "text-info";
  return "text-success";
}

function outageBackground(status: string) {
  if (status === "PSPS Active" || status === "EPSS Active") return "bg-destructive/10 border-destructive/30";
  if (status === "Patrolling") return "bg-warning/10 border-warning/30";
  return "bg-muted/50 border-border";
}

export default function SafetyModules({ customer }: { customer: Customer }) {
  const isOutageActive = customer.current_outage_status !== "Normal";
  const remaining = useCountdown(customer.restoration_timer, isOutageActive);
  
  return (
    <div className="space-y-4">
      {/* Outage Status Banner */}
      <div className={`p-4 rounded-lg border ${outageBackground(customer.current_outage_status)} space-y-3`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${outageColor(customer.current_outage_status)}`} />
          <h3 className="text-sm font-semibold text-card-foreground">Outage Status</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Status</p>
            <p className={`text-sm font-bold ${outageColor(customer.current_outage_status)}`}>
              {customer.current_outage_status}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">⏱️ ETR</p>
            {isOutageActive && remaining !== null && remaining > 0 ? (
              <p className="text-sm font-bold text-destructive flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                {formatCountdown(remaining)}
              </p>
            ) : (
              <p className="text-sm font-bold text-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {isOutageActive ? customer.restoration_timer : "N/A"}
              </p>
            )}
          </div>
        </div>

        {/* Status Pipeline */}
        {customer.current_outage_status !== "Normal" && (
          <div className="flex items-center gap-1 pt-1">
            {OUTAGE_STAGES.map((stage, i) => {
              const activeIdx = OUTAGE_STAGES.findIndex(s => s === customer.current_outage_status);
              const isActive = i <= activeIdx;
              const isCurrent = i === activeIdx;
              return (
                <div key={stage} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`h-1.5 rounded-full flex-1 ${isCurrent ? "bg-primary animate-pulse" : isActive ? "bg-primary" : "bg-muted"}`} />
                  {i === OUTAGE_STAGES.length - 1 && (
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-0.5">24hr goal</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {customer.current_outage_status !== "Normal" && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            {OUTAGE_STAGES.map((stage) => (
              <span key={stage} className={`flex-1 min-w-0 truncate ${stage === customer.current_outage_status ? "font-bold text-foreground" : ""}`}>
                {stage}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons — Red=Urgent, Green=Available, Blue=Action */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => toast.info(`ETR updated for ${customer.name}`)}
            className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 text-destructive font-medium transition-colors"
          >
            <Clock className="w-3 h-3" />
            Update ETR
          </button>
          <button
            onClick={() => toast.success(`Digital notice sent to ${customer.name}`)}
            className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            Send Notice
          </button>
          <button
            onClick={() => toast.info(`Nearest CRC: ${customer.nearest_crc_location || "None found"}`)}
            className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary font-medium transition-colors"
          >
            <MapPin className="w-3 h-3" />
            Locate CRC
          </button>
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
      {customer.nearest_crc_location && customer.current_outage_status !== "Normal" && (
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
            <button
              onClick={() => toast.info(`Opening map for ${customer.nearest_crc_location}`)}
              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <MapPin className="w-3 h-3" />
              Open Map
            </button>
            <button
              onClick={() => toast.success(`Directions sent to ${customer.name}`)}
              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition-colors"
            >
              <Send className="w-3 h-3" />
              Send Directions
            </button>
          </div>
        </div>
      )}

      {/* CRC info when power is normal */}
      {customer.nearest_crc_location && customer.current_outage_status === "Normal" && (
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

import { Battery, BatteryCharging, Gauge, MapPin, Clock, Activity, CheckSquare, Plug } from "lucide-react";
import type { Customer } from "@/lib/customer-types";
import { toast } from "sonner";

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
  return (
    <div className="space-y-4">
      {/* Outage Status Banner */}
      <div className={`p-4 rounded-lg border ${outageBackground(customer.current_outage_status)}`}>
        <div className="flex items-center gap-2 mb-2">
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
            <p className="text-xs text-muted-foreground">Est. Restoration</p>
            <p className="text-sm font-bold text-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {customer.current_outage_status === "Normal" ? "N/A" : customer.restoration_timer}
            </p>
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
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition-colors"
          >
            <Gauge className="w-3 h-3" />
            View Backup Status
          </button>
          <button
            onClick={() => toast.success(`Connection test sent to ${customer.name}'s backup systems`)}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition-colors"
          >
            <Plug className="w-3 h-3" />
            Test Connection
          </button>
        </div>
      </div>

      {/* Nearest CRC */}
      {customer.nearest_crc_location && (
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

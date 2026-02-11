import { Battery, BatteryCharging, Gauge, MapPin, Clock, Activity } from "lucide-react";
import type { Customer } from "@/lib/customer-types";

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

      {/* Battery & Backup Resources */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="w-4 h-4 text-info" />
          <h3 className="text-sm font-semibold text-card-foreground">Backup Resources</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <ResourceRow
            icon={Battery}
            label="Portable Battery"
            value={customer.has_portable_battery ? "Available" : "None"}
            positive={customer.has_portable_battery}
          />
          <ResourceRow
            icon={Gauge}
            label="Transfer Meter"
            value={customer.has_transfer_meter ? "Installed" : "None"}
            positive={customer.has_transfer_meter}
          />
          <ResourceRow
            icon={BatteryCharging}
            label="Permanent Battery"
            value={customer.has_permanent_battery}
            positive={customer.has_permanent_battery !== "None"}
          />
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

function ResourceRow({ icon: Icon, label, value, positive }: {
  icon: React.ElementType;
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${positive ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-xs font-medium ${positive ? "text-success" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

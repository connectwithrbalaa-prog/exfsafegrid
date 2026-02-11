import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { User, Zap, Flame, DollarSign, MessageSquare, AlertTriangle } from "lucide-react";

export default function AgentView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) {
          const typed = data as unknown as Customer[];
          setCustomers(typed);
        }
      });
  }, []);

  const handleSelect = (id: string) => {
    const c = customers.find((c) => c.id === id) || null;
    setSelected(c);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* LEFT COLUMN — 70% */}
      <div className="lg:col-span-7 space-y-5">
        {/* Customer selector */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-4">
          <label htmlFor="agent-customer-select" className="text-sm font-semibold text-card-foreground">
            Select Customer
          </label>
          <select
            id="agent-customer-select"
            value={selected?.id ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choose a customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — ZIP {c.zip_code}
              </option>
            ))}
          </select>
        </div>

        {/* Selected customer detail cards */}
        {selected ? (
          <div className="grid grid-cols-2 gap-4">
            <DetailCard icon={User} label="Name" value={selected.name} />
            <DetailCard icon={Zap} label="ZIP Code" value={selected.zip_code} />
            <DetailCard icon={Flame} label="Wildfire Risk" value={selected.wildfire_risk} color={riskColor(selected.wildfire_risk)} />
            <DetailCard icon={DollarSign} label="Arrears" value={selected.arrears_status === "Yes" ? `Yes — $${selected.arrears_amount}` : "No"} color={selected.arrears_status === "Yes" ? "text-warning" : "text-success"} />
            <DetailCard icon={AlertTriangle} label="Grid Stress" value={selected.grid_stress_level} color={riskColor(selected.grid_stress_level)} />
            <DetailCard icon={Zap} label="Bill Trend" value={selected.bill_trend} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Select a customer above to view their details
          </div>
        )}
      </div>

      {/* RIGHT COLUMN — 30% */}
      <div className="lg:col-span-3 space-y-4">
        <h2 className="text-xl font-bold text-foreground">Agent Dashboard</h2>

        {/* Customer Profile card */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-2">
          <h3 className="text-sm font-semibold text-card-foreground">Customer Profile</h3>
          {selected ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">{selected.name}</span></p>
              <p>Email: {selected.email ?? "—"}</p>
              <p>ZIP: {selected.zip_code}</p>
              <p>Outages: {selected.outage_history || "None"}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No customer selected</p>
          )}
        </div>

        {/* Quick Actions card */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold text-card-foreground">Quick Actions</h3>
          <div className="space-y-2">
            {["Escalate to Supervisor", "Send Payment Reminder", "Schedule Callback", "Flag for Review"].map((action) => (
              <button
                key={action}
                disabled={!selected}
                className="w-full text-left text-sm px-3 py-2 rounded-md border border-border hover:bg-secondary text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* AI Assistant Chat placeholder */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-2">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            AI Assistant Chat
          </h3>
          <div className="h-32 rounded-md border border-dashed border-border flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Agent chat coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function riskColor(level: string) {
  if (level === "High") return "text-destructive";
  if (level === "Medium") return "text-warning";
  return "text-success";
}

function DetailCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
        <Icon className={`w-5 h-5 ${color ?? "text-info"}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-bold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

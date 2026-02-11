import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { buildCustomerContext } from "@/lib/customer-types";
import { User, Zap, Flame, DollarSign, MessageSquare, AlertTriangle } from "lucide-react";
import AgentChatPanel from "@/components/AgentChatPanel";
import { toast } from "sonner";

export default function AgentView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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
    setNotes(c?.agent_notes ?? "");
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("customers")
      .update({ agent_notes: notes } as any)
      .eq("id", selected.id as any);
    setSavingNotes(false);
    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
      setSelected({ ...selected, agent_notes: notes });
    }
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
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{selected.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">ZIP</dt><dd className="font-medium text-foreground">{selected.zip_code}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Wildfire Risk</dt><dd className={`font-medium ${riskColor(selected.wildfire_risk)}`}>{selected.wildfire_risk}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Arrears</dt><dd className="font-medium text-foreground">{selected.arrears_status === "Yes" ? `Yes ($${selected.arrears_amount})` : "No ($0)"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Bill Trend</dt><dd className="font-medium text-foreground">{selected.bill_trend}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Grid Stress</dt><dd className={`font-medium ${riskColor(selected.grid_stress_level)}`}>{selected.grid_stress_level}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No customer selected</p>
          )}
        </div>

        {/* Quick Actions card */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold text-card-foreground">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: "📞", label: "Call Customer" },
              { emoji: "💰", label: "Apply REACH" },
              { emoji: "⚠️", label: "PSPS Alert" },
              { emoji: "📝", label: "Add Note" },
            ].map((action) => (
              <button
                key={action.label}
                disabled={!selected}
                onClick={() => toast.success(`Action logged: ${action.label}${selected ? ` for ${selected.name}` : ""}`)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border hover:bg-secondary text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{action.emoji}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Notes */}
        <div className="p-5 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold text-card-foreground">Agent Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!selected}
            placeholder={selected ? "Add notes about this customer..." : "Select a customer first"}
            className="w-full h-28 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
          />
          <button
            onClick={saveNotes}
            disabled={!selected || savingNotes}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {savingNotes ? "Saving…" : "Save Notes"}
          </button>
        </div>

        {/* AI Assistant Chat */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">AI Assistant Chat</h3>
          </div>
          {selected ? (
            <div className="h-[400px]">
              <AgentChatPanel key={selected.id} customerContext={buildCustomerContext(selected)} />
            </div>
          ) : (
            <div className="h-[360px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a customer to start chatting</p>
            </div>
          )}
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

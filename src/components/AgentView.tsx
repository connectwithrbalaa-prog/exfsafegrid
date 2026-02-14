import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { buildCustomerContext } from "@/lib/customer-types";
import {
  REGIONS, AGENT_REGIONS, type Region,
  getRedFlagPriority, getPriorityLabel, getPriorityColor, sortCustomers,
} from "@/lib/region-utils";
import {
  User, Zap, Flame, DollarSign, MessageSquare, AlertTriangle,
  Shield, HeartPulse, MapPin, Radio, Building2,
} from "lucide-react";
import AgentChatPanel from "@/components/AgentChatPanel";
import SafetyModules from "@/components/SafetyModules";
import ReportHazard from "@/components/ReportHazard";
import AgentRequestsPanel from "@/components/AgentRequestsPanel";
import WildfireMap from "@/components/WildfireMap";
import { getSubstationForZip } from "@/lib/wildfire-utils";

import { toast } from "sonner";

interface RedFlagData {
  [region: string]: { active: boolean; headline?: string };
}

interface AgentViewProps {
  agentEmail?: string;
}

export default function AgentView({ agentEmail }: AgentViewProps) {
  const agentRegion: Region = (agentEmail && AGENT_REGIONS[agentEmail]) || "Bay Area";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [redFlagData, setRedFlagData] = useState<RedFlagData>({});
  const [loadingRedFlag, setLoadingRedFlag] = useState(true);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const redFlagActive = redFlagData[agentRegion]?.active ?? false;

  // Fetch Red Flag Warning status
  const fetchRedFlagStatus = useCallback(async () => {
    setLoadingRedFlag(true);
    try {
      const res = await supabase.functions.invoke("red-flag-status");
      if (res.data && !res.error) {
        setRedFlagData(res.data as RedFlagData);
      }
    } catch (e) {
      console.error("Failed to fetch Red Flag status", e);
    }
    setLoadingRedFlag(false);
  }, []);

  useEffect(() => {
    fetchRedFlagStatus();
  }, [fetchRedFlagStatus]);

  // Fetch customers filtered by agent's region
  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .eq("region", agentRegion)
      .order("name")
      .then(({ data }) => {
        if (data) setCustomers(data as unknown as Customer[]);
      });

    // Realtime: live updates across all agents
    const channel = supabase
      .channel("customers-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "customers" },
        (payload) => {
          const updated = payload.new as unknown as Customer;
          // Update customer list
          setCustomers((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
          // Update selected customer if it's the one that changed
          setSelected((prev) =>
            prev && prev.id === updated.id ? updated : prev
          );
          if (selected?.id === updated.id) {
            setNotes(updated.agent_notes ?? "");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentRegion]);

  const sortedCustomers = sortCustomers(customers, redFlagActive);

  const handleSelect = async (id: string) => {
    if (!id) { setSelected(null); setNotes(""); return; }
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const c = data ? (data as unknown as Customer) : customers.find((c) => c.id === id) || null;
    setSelected(c);
    setNotes(c?.agent_notes ?? "");
    setCompletedActions(new Set());
  };

  const handleQuickAction = async (label: string) => {
    if (!selected) return;
    if (label === "Apply REACH") {
      const newAmount = Math.round(selected.arrears_amount * 0.5 * 100) / 100;
      await supabase
        .from("customers")
        .update({ arrears_amount: newAmount } as any)
        .eq("id", selected.id as any);
      setSelected({ ...selected, arrears_amount: newAmount });
      toast.success(`REACH applied for ${selected.name} — arrears reduced to $${newAmount}`);
    } else if (label === "PSPS Alert") {
      toast.success(`PSPS alert sent to ${selected.name}`);
    } else if (label === "Add Note") {
      notesRef.current?.scrollIntoView({ behavior: "smooth" });
      notesRef.current?.focus();
      return;
    } else {
      toast.success(`Action logged: ${label} for ${selected.name}`);
    }
    setCompletedActions((prev) => new Set(prev).add(label));
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

  const priority = selected ? getRedFlagPriority(selected) : 0;

  return (
    <div className="space-y-4">
      {/* Region & Red Flag Banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Region: {agentRegion}</span>
          <span className="text-xs text-muted-foreground">({customers.length} customers)</span>
        </div>
        <button
          onClick={fetchRedFlagStatus}
          disabled={loadingRedFlag}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Radio className={`w-3.5 h-3.5 ${loadingRedFlag ? "animate-spin" : ""}`} />
          {loadingRedFlag ? "Checking…" : "Refresh Weather Alerts"}
        </button>
      </div>

      {redFlagActive && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-destructive">🔴 Red Flag Warning Active — {agentRegion}</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {redFlagData[agentRegion]?.headline || "Elevated fire weather conditions. Customers re-ranked by risk priority."}
            </p>
          </div>
        </div>
      )}

      {!redFlagActive && !loadingRedFlag && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
          <Shield className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            No active Red Flag Warnings for {agentRegion}. Customers sorted alphabetically.
          </p>
        </div>
      )}

      {/* Wildfire Map — full width */}
      <WildfireMap />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN — customer selector + details */}
        <div className="lg:col-span-5 space-y-5">
          {/* Customer selector */}
          <div className="p-5 rounded-lg border border-border bg-card space-y-4">
            <label htmlFor="agent-customer-select" className="text-sm font-semibold text-card-foreground">
              Select Customer {redFlagActive && <span className="text-xs text-destructive ml-1">(Priority Ranked)</span>}
            </label>
            <select
              id="agent-customer-select"
              value={selected?.id ?? ""}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Choose a customer —</option>
              {sortedCustomers.map((c) => {
                const p = redFlagActive ? getRedFlagPriority(c) : 0;
                const prefix = p > 0 ? `[P${p}] ` : "";
                return (
                  <option key={c.id} value={c.id}>
                    {prefix}{c.name} — ZIP {c.zip_code} — HFTD {c.hftd_tier}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected customer detail cards */}
          {selected ? (
            <div className="space-y-4">
              {redFlagActive && priority > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
                  <AlertTriangle className={`w-4 h-4 ${getPriorityColor(priority)}`} />
                  <span className={`text-sm font-bold ${getPriorityColor(priority)}`}>
                    {getPriorityLabel(priority)}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <DetailCard icon={User} label="Name" value={selected.name} />
                <DetailCard icon={Zap} label="ZIP Code" value={selected.zip_code} />
                <DetailCard icon={MapPin} label="Region" value={selected.region} />
                <DetailCard icon={Flame} label="Wildfire Risk" value={selected.wildfire_risk} color={riskColor(selected.wildfire_risk)} />
                <DetailCard icon={Shield} label="HFTD Tier" value={selected.hftd_tier} color={hftdColor(selected.hftd_tier)} />
                <DetailCard icon={HeartPulse} label="Medical Baseline" value={selected.medical_baseline ? "Enrolled" : "No"} color={selected.medical_baseline ? "text-info" : undefined} />
                <DetailCard icon={DollarSign} label="Arrears" value={selected.arrears_status === "Yes" ? `Yes — $${selected.arrears_amount}` : "No"} color={selected.arrears_status === "Yes" ? "text-warning" : "text-success"} />
                <DetailCard icon={AlertTriangle} label="Grid Stress" value={selected.grid_stress_level} color={riskColor(selected.grid_stress_level)} />
                <DetailCard icon={Zap} label="Bill Trend" value={selected.bill_trend} />
              </div>

              {/* Substation & Zone Summary */}
              {(() => {
                const ss = getSubstationForZip(selected.zip_code);
                return (
                  <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-info" />
                      <h3 className="text-xs font-semibold text-card-foreground">Serving Infrastructure</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Substation</span>
                        <p className="font-semibold text-card-foreground">{ss.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Zone</span>
                        <p className="font-semibold text-card-foreground">{ss.zone}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Voltage</span>
                        <p className="font-medium text-card-foreground">{ss.voltage}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Capacity</span>
                        <p className="font-medium text-card-foreground">{ss.capacityMW} MW</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Status</span>
                        <p className={`font-semibold ${ss.status === "Online" ? "text-success" : ss.status === "Reduced" ? "text-warning" : "text-destructive"}`}>
                          {ss.status === "Online" ? "🟢" : ss.status === "Reduced" ? "🟡" : "🔴"} {ss.status}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Agent Notes — inline with details */}
              <div className="p-5 rounded-lg border border-border bg-card space-y-3">
                <h3 className="text-sm font-semibold text-card-foreground">Agent Notes</h3>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!selected}
                  placeholder="Add notes about this customer..."
                  className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={!selected || savingNotes}
                  className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Select a customer above to view their details
            </div>
          )}
        </div>

        {/* MIDDLE COLUMN — Safety modules (tabbed) + Quick Actions */}
        <div className="lg:col-span-4 space-y-4">
          {selected && (
            <>
              {/* Compact Customer Summary Bar */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <User className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold text-card-foreground truncate">{selected.name}</span>
                <span className={`text-xs font-medium ml-auto ${riskColor(selected.wildfire_risk)}`}>
                  🔥 {selected.wildfire_risk}
                </span>
              </div>

              {/* Medical Priority Badge */}
              {selected.medical_baseline && (
                <div className="p-3 rounded-lg border-2 border-destructive bg-destructive/10 shadow-md shadow-destructive/10">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-destructive animate-pulse" />
                    <span className="text-xs font-bold text-destructive">🚨 MEDICAL BASELINE</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      onClick={() => toast.success(`Doorbell verification dispatched for ${selected.name}`)}
                      className="px-2 py-1 text-[10px] font-medium rounded-full bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                    >
                      🔔 Doorbell Ring
                    </button>
                    <button
                      onClick={() => toast.success(`Priority restoration flagged for ${selected.name}`)}
                      className="px-2 py-1 text-[10px] font-medium rounded-full bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                    >
                      ⚡ Priority Restore
                    </button>
                  </div>
                </div>
              )}

              {/* Tabbed Safety Modules */}
              <SafetyModules customer={selected} />
            </>
          )}

          {/* Quick Actions */}
          <div className="p-5 rounded-lg border border-border bg-card space-y-3">
            <h3 className="text-sm font-semibold text-card-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { emoji: "📞", label: "Call Customer" },
                { emoji: "💰", label: "Apply REACH" },
                { emoji: "⚠️", label: "PSPS Alert" },
                { emoji: "📝", label: "Add Note" },
              ].map((action) => {
                const done = completedActions.has(action.label);
                return (
                  <button
                    key={action.label}
                    disabled={!selected}
                    onClick={() => handleQuickAction(action.label)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      done
                        ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                        : "border-border hover:bg-secondary text-foreground"
                    }`}
                  >
                    <span>{action.emoji}</span>
                    {action.label}
                    {done && <span className="ml-auto text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — AI Chat + Requests + Hazard */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">AI Assistant</h3>
            </div>
            {selected ? (
              <div className="h-[400px]">
                <AgentChatPanel key={selected.id} customerContext={buildCustomerContext(selected)} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Select a customer to start chatting</p>
              </div>
            )}
          </div>

          <AgentRequestsPanel />
          <ReportHazard customerName={selected?.name} />
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

function hftdColor(tier: string) {
  if (tier === "Tier 3") return "text-destructive";
  if (tier === "Tier 2") return "text-warning";
  return "text-muted-foreground";
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

function ProfileRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium ${color || "text-foreground"}`}>{value}</dd>
    </div>
  );
}

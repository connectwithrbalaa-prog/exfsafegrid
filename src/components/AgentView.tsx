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
  ChevronDown, ChevronUp, TrendingUp, Keyboard,
  Map, ClipboardList, Bot, Wrench,
} from "lucide-react";
import AgentChatPanel from "@/components/AgentChatPanel";
import SafetyModules from "@/components/SafetyModules";
import ReportHazard from "@/components/ReportHazard";
import AgentRequestsPanel from "@/components/AgentRequestsPanel";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import { getSubstationForZip } from "@/lib/wildfire-utils";
import PredictiveOutagePanel from "@/components/PredictiveOutagePanel";
import HardshipTriagePanel from "@/components/HardshipTriagePanel";
import AgentRiskForecastPanel from "@/components/AgentRiskForecastPanel";
import PspsImpactCard from "@/components/PspsImpactCard";
import { useKeyboardShortcuts, SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

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
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [activeSection, setActiveSection] = useState<"risk" | "support" | "map">("risk");
  const [advancedTab, setAdvancedTab] = useState<"predictive" | "hardship">("predictive");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLSelectElement>(null);

  const redFlagActive = redFlagData[agentRegion]?.active ?? false;

  // Keyboard shortcuts
  const QUICK_ACTIONS = ["Call Customer", "Apply REACH", "PSPS Alert", "Add Note"];
  useKeyboardShortcuts({
    onFocusSearch: () => { searchRef.current?.focus(); toast.info("Ctrl+K — Customer selector focused"); },
    onSaveNotes:   () => { if (selected) saveNotes(); },
    onRefreshAlerts: () => fetchRedFlagStatus(),
    onQuickAction: (n) => { if (selected) handleQuickAction(QUICK_ACTIONS[n - 1]); },
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

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

  useEffect(() => { fetchRedFlagStatus(); }, [fetchRedFlagStatus]);

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

    const channel = supabase
      .channel("customers-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "customers" },
        (payload) => {
          const updated = payload.new as unknown as Customer;
          setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelected((prev) => prev && prev.id === updated.id ? updated : prev);
          if (selected?.id === updated.id) setNotes(updated.agent_notes ?? "");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      setActiveSection("risk");
      setTimeout(() => {
        notesRef.current?.scrollIntoView({ behavior: "smooth" });
        notesRef.current?.focus();
      }, 100);
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
  const ss = selected ? getSubstationForZip(selected.zip_code) : null;

  const SECTION_TABS = [
    { key: "risk" as const, label: "Safety & Risk", icon: Shield },
    { key: "support" as const, label: "Support & Programs", icon: ClipboardList },
    { key: "map" as const, label: "Map & Transparency", icon: Map },
  ];

  return (
    <div className="space-y-4">
      {/* Region & Red Flag Banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Region: {agentRegion}</span>
          <span className="text-xs text-muted-foreground">({customers.length} customers)</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); setShowShortcutsHelp(true); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <button
            onClick={fetchRedFlagStatus}
            disabled={loadingRedFlag}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Radio className={`w-3.5 h-3.5 ${loadingRedFlag ? "animate-spin" : ""}`} />
            {loadingRedFlag ? "Checking…" : "Refresh Alerts"}
          </button>
        </div>
      </div>

      {redFlagActive && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-destructive">🔴 Red Flag Warning — {agentRegion}</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {redFlagData[agentRegion]?.headline || "Elevated fire weather. Customers re-ranked by risk priority."}
            </p>
          </div>
        </div>
      )}

      {!redFlagActive && !loadingRedFlag && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/50">
          <Shield className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            No active Red Flag Warnings for {agentRegion}. Customers sorted alphabetically.
          </p>
        </div>
      )}

      {/* Customer Selector — always visible */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
        <User className="w-4 h-4 text-primary flex-shrink-0" />
        <select
          id="agent-customer-select"
          ref={searchRef}
          value={selected?.id ?? ""}
          onChange={(e) => handleSelect(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
        {selected && (
          <div className="hidden sm:flex items-center gap-2">
            <span className={`text-xs font-semibold ${riskColor(selected.wildfire_risk)}`}>
              🔥 {selected.wildfire_risk}
            </span>
            {selected.medical_baseline && (
              <span className="text-xs font-bold text-destructive flex items-center gap-1">
                <HeartPulse className="w-3 h-3" /> MBL
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30">
        {SECTION_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveSection(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeSection === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ SAFETY & RISK ═══════ */}
      {activeSection === "risk" && (
        <div className="space-y-4">
          {selected ? (
            <>
              {/* Priority badge */}
              {redFlagActive && priority > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                  <AlertTriangle className={`w-4 h-4 ${getPriorityColor(priority)}`} />
                  <span className={`text-sm font-bold ${getPriorityColor(priority)}`}>
                    {getPriorityLabel(priority)}
                  </span>
                </div>
              )}

              {/* Medical Baseline Alert */}
              {selected.medical_baseline && (
                <div className="p-3 rounded-lg border-2 border-destructive bg-destructive/10">
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

              {/* Risk Forecast + PSPS Impact side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AgentRiskForecastPanel customer={selected} />
                <PspsImpactCard customer={selected} />
              </div>

              {/* Safety Modules */}
              <SafetyModules customer={selected} />

              {/* Hazard Report */}
              <ReportHazard customerName={selected.name} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-border text-muted-foreground gap-2">
              <Shield className="w-6 h-6 opacity-40" />
              <p className="text-sm">Select a customer to view safety & risk data</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════ SUPPORT & PROGRAMS ═══════ */}
      {activeSection === "support" && (
        <div className="space-y-4">
          {selected ? (
            <>
              {/* Customer Profile */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Customer Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <CompactDetail label="Name" value={selected.name} />
                    <CompactDetail label="ZIP" value={selected.zip_code} />
                    <CompactDetail label="Region" value={selected.region} />
                    <CompactDetail label="Wildfire Risk" value={selected.wildfire_risk} color={riskColor(selected.wildfire_risk)} />
                    <CompactDetail label="HFTD Tier" value={selected.hftd_tier} color={hftdColor(selected.hftd_tier)} />
                    <CompactDetail label="Medical Baseline" value={selected.medical_baseline ? "Enrolled" : "No"} color={selected.medical_baseline ? "text-info" : undefined} />
                    <CompactDetail label="Arrears" value={selected.arrears_status === "Yes" ? `$${selected.arrears_amount}` : "None"} color={selected.arrears_status === "Yes" ? "text-warning" : "text-success"} />
                    <CompactDetail label="Grid Stress" value={selected.grid_stress_level} color={riskColor(selected.grid_stress_level)} />
                  </div>
                </div>

                {/* Infrastructure */}
                {ss && (
                  <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                    <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-info" /> Serving Infrastructure
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <CompactDetail label="Substation" value={ss.name} />
                      <CompactDetail label="Zone" value={ss.zone} />
                      <CompactDetail label="Voltage" value={ss.voltage} />
                      <CompactDetail label="Capacity" value={`${ss.capacityMW} MW`} />
                      <div className="col-span-2">
                        <CompactDetail
                          label="Status"
                          value={`${ss.status === "Online" ? "🟢" : ss.status === "Reduced" ? "🟡" : "🔴"} ${ss.status}`}
                          color={ss.status === "Online" ? "text-success" : ss.status === "Reduced" ? "text-warning" : "text-destructive"}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <h3 className="text-sm font-semibold text-card-foreground">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        onClick={() => handleQuickAction(action.label)}
                        className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors ${
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

              {/* AI Assistant */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">AI Assistant</h3>
                  <span className="text-xs text-muted-foreground ml-auto">Customer: {selected.name}</span>
                </div>
                <div className="h-[400px]">
                  <AgentChatPanel key={selected.id} customerContext={buildCustomerContext(selected)} />
                </div>
              </div>

              {/* Agent Notes */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <h3 className="text-sm font-semibold text-card-foreground">Agent Notes</h3>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this customer..."
                  className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </button>
              </div>

              {/* Agent Requests & Hardship/Predictive */}
              <AgentRequestsPanel />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <PredictiveOutagePanel customers={customers} />
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <HardshipTriagePanel
                    customers={customers}
                    onCustomerUpdate={(updated) => {
                      setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                      if (selected?.id === updated.id) setSelected(updated);
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-border text-muted-foreground gap-2">
              <User className="w-6 h-6 opacity-40" />
              <p className="text-sm">Select a customer to view support tools</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════ MAP & TRANSPARENCY ═══════ */}
      {activeSection === "map" && (
        <div className="space-y-4">
          {selected ? (
            <>
              <CustomerWildfireMap
                customerZip={selected.zip_code}
                assetLat={ss?.latitude ?? 37.20}
                assetLng={ss?.longitude ?? -119.30}
                hftdTier={selected.hftd_tier ?? "None"}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-border text-muted-foreground gap-2">
              <Map className="w-6 h-6 opacity-40" />
              <p className="text-sm">Select a customer to view the wildfire map</p>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Keyboard className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.description}</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs font-mono">
                    {s.modifier === "ctrl" ? "Ctrl+" : ""}{s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="mt-4 w-full py-2 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────── */

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

function CompactDetail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${color ?? "text-card-foreground"}`}>{value}</p>
    </div>
  );
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

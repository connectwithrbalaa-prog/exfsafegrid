import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Map, ClipboardList, Bot, Wrench, Search, Phone,
  Activity, Layers, RefreshCw,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import AgentChatPanel from "@/components/AgentChatPanel";
import TabbedChatPanel from "@/components/TabbedChatPanel";
import { PREDICTIONS_CONFIG } from "@/lib/predictions-config";
import SafetyModules from "@/components/SafetyModules";
import ReportHazard from "@/components/ReportHazard";
import AgentRequestsPanel from "@/components/AgentRequestsPanel";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import AgentSafetyMapPanel from "@/components/AgentSafetyMapPanel";
import NotificationHistoryCard from "@/components/NotificationHistoryCard";
import { getSubstationForZip } from "@/lib/wildfire-utils";
import PredictiveOutagePanel from "@/components/PredictiveOutagePanel";
import HardshipTriagePanel from "@/components/HardshipTriagePanel";
import AgentRiskForecastPanel from "@/components/AgentRiskForecastPanel";
import PspsImpactCard from "@/components/PspsImpactCard";
import ProgramsEligibilityCard from "@/components/ProgramsEligibilityCard";
import LocalSupportCard from "@/components/LocalSupportCard";
import { useKeyboardShortcuts, SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";
import RiskTrendMini from "@/components/RiskTrendMini";

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
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLSelectElement>(null);

  const isMobile = useIsMobile();
  const redFlagActive = redFlagData[agentRegion]?.active ?? false;




  const QUICK_ACTIONS = ["Call Customer", "Apply REACH", "PSPS Alert", "Add Note"];
  useKeyboardShortcuts({
    onFocusSearch: () => { searchRef.current?.focus(); toast.info("Ctrl+K — Customer selector focused"); },
    onSaveNotes:   () => { if (selected) saveNotes(); },
    onRefreshAlerts: () => fetchRedFlagStatus(),
    onQuickAction: (n) => { if (selected) handleQuickAction(QUICK_ACTIONS[n - 1]); },
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  const fetchRedFlagStatus = useCallback(async () => {
    setLoadingRedFlag(true);
    try {
      const res = await supabase.functions.invoke("red-flag-status");
      if (res.data && !res.error) setRedFlagData(res.data as RedFlagData);
    } catch (e) { console.error("Failed to fetch Red Flag status", e); }
    setLoadingRedFlag(false);
  }, []);

  useEffect(() => { fetchRedFlagStatus(); }, [fetchRedFlagStatus]);

  const refreshAllData = useCallback(async () => {
    await fetchRedFlagStatus();
    const { data } = await supabase.from("customers").select("*").eq("region", agentRegion).order("name");
    if (data) {
      setCustomers(data as unknown as Customer[]);
      if (selected) {
        const updated = (data as unknown as Customer[]).find(c => c.id === selected.id);
        if (updated) { setSelected(updated); setNotes(updated.agent_notes ?? ""); }
      }
    }
    toast.success("Data refreshed");
  }, [agentRegion, selected, fetchRedFlagStatus]);

  const { pullDistance, isRefreshing: pullRefreshing } = usePullToRefresh({
    onRefresh: refreshAllData,
    enabled: isMobile,
  });

  useEffect(() => {
    supabase.from("customers").select("*").eq("region", agentRegion).order("name")
      .then(({ data }) => { if (data) setCustomers(data as unknown as Customer[]); });

    const channel = supabase
      .channel("customers-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "customers" }, (payload) => {
        const updated = payload.new as unknown as Customer;
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelected((prev) => prev && prev.id === updated.id ? updated : prev);
        if (selected?.id === updated.id) setNotes(updated.agent_notes ?? "");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agentRegion]);

  const sortedCustomers = sortCustomers(customers, redFlagActive);

  const handleSelect = async (id: string) => {
    if (!id) { setSelected(null); setNotes(""); return; }
    const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    const c = data ? (data as unknown as Customer) : customers.find((c) => c.id === id) || null;
    setSelected(c);
    setNotes(c?.agent_notes ?? "");
    setCompletedActions(new Set());
  };

  const handleQuickAction = async (label: string) => {
    if (!selected) return;
    if (label === "Apply REACH") {
      const newAmount = Math.round(selected.arrears_amount * 0.5 * 100) / 100;
      await supabase.from("customers").update({ arrears_amount: newAmount } as any).eq("id", selected.id as any);
      setSelected({ ...selected, arrears_amount: newAmount });
      toast.success(`REACH applied — arrears reduced to $${newAmount}`);
    } else if (label === "PSPS Alert") {
      toast.success(`PSPS alert sent to ${selected.name}`);
    } else if (label === "Add Note") {
      setActiveSection("support");
      setTimeout(() => { notesRef.current?.scrollIntoView({ behavior: "smooth" }); notesRef.current?.focus(); }, 100);
      return;
    } else {
      toast.success(`Action logged: ${label} for ${selected.name}`);
    }
    setCompletedActions((prev) => new Set(prev).add(label));
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase.from("customers").update({ agent_notes: notes } as any).eq("id", selected.id as any);
    setSavingNotes(false);
    if (error) { toast.error("Failed to save notes"); }
    else { toast.success("Notes saved"); setSelected({ ...selected, agent_notes: notes }); }
  };

  const priority = selected ? getRedFlagPriority(selected) : 0;
  const ss = selected ? getSubstationForZip(selected.zip_code) : null;

  const SECTION_TABS = [
    { key: "risk" as const, label: "Safety & Risk", icon: Shield, desc: "Risk forecast & PSPS" },
    { key: "support" as const, label: "Support", icon: ClipboardList, desc: "Profile & programs" },
    { key: "map" as const, label: "Map", icon: Map, desc: "Wildfire map" },
  ];

  return (
    <div className="space-y-5 relative">
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform"
          style={{ transform: `translateY(${pullDistance - 40}px)` }}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <RefreshCw
              className={`w-4 h-4 text-primary ${pullRefreshing ? "animate-spin" : ""}`}
              style={{ transform: pullRefreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>
      )}
      {/* ── Top Bar: Region + Actions ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">{agentRegion}</h2>
            <p className="text-xs text-muted-foreground">{customers.length} customers in region</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowShortcutsHelp(true); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={fetchRedFlagStatus}
            disabled={loadingRedFlag}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Radio className={`w-3.5 h-3.5 ${loadingRedFlag ? "animate-spin" : ""}`} />
            {loadingRedFlag ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Red Flag Warning Banner ── */}
      {redFlagActive && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/40 bg-gradient-to-r from-destructive/8 to-destructive/4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-destructive/15 flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-bold text-destructive">Red Flag Warning Active</p>
            <p className="text-xs text-destructive/70 mt-0.5 leading-relaxed">
              {redFlagData[agentRegion]?.headline || "Elevated fire weather conditions. Customers re-ranked by risk priority."}
            </p>
          </div>
        </div>
      )}

      {!redFlagActive && !loadingRedFlag && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-success/20 bg-success/5">
          <Shield className="w-4 h-4 text-success" />
          <p className="text-xs text-success font-medium">No active warnings for {agentRegion}</p>
        </div>
      )}

      {/* ── Customer Selector ── */}
      <div className="relative">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
          <select
            id="agent-customer-select"
            ref={searchRef}
            value={selected?.id ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border-0 bg-transparent text-sm text-foreground focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="">Select a customer…</option>
            {sortedCustomers.map((c) => {
              const p = redFlagActive ? getRedFlagPriority(c) : 0;
              const prefix = p > 0 ? `[P${p}] ` : "";
              return (
                <option key={c.id} value={c.id}>
                  {prefix}{c.name} — {c.zip_code} — HFTD {c.hftd_tier}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* ── Selected Customer Summary Strip ── */}
      {selected && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {[
            <SummaryChip key="name" icon={User} label="Customer" value={selected.name} />,
            <SummaryChip key="zip" icon={MapPin} label="ZIP / HFTD" value={`${selected.zip_code} · ${selected.hftd_tier}`} color={hftdColor(selected.hftd_tier)} />,
            <SummaryChip key="fire" icon={Flame} label="Fire Risk" value={selected.wildfire_risk} color={riskColor(selected.wildfire_risk)} />,
            <SummaryChip key="outage" icon={Zap} label="Outage" value={selected.current_outage_status}
              color={selected.current_outage_status === "Normal" ? "text-success" : "text-warning"} />,
            <SummaryChip key="grid" icon={Activity} label="Grid Stress" value={selected.grid_stress_level} color={riskColor(selected.grid_stress_level)} />,
            selected.medical_baseline ? (
              <SummaryChip key="med" icon={HeartPulse} label="Medical" value="Enrolled" color="text-destructive" highlight />
            ) : (
              <SummaryChip key="arr" icon={DollarSign} label="Arrears" value={selected.arrears_status === "Yes" ? `$${selected.arrears_amount}` : "None"}
                color={selected.arrears_status === "Yes" ? "text-warning" : "text-success"} />
            ),
          ].map((chip, i) => (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {chip}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Section Tabs ── */}
      <div className="flex gap-2 p-1.5 rounded-xl border border-border bg-muted/40">
        {SECTION_TABS.map((t) => {
          const active = activeSection === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveSection(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-card text-foreground shadow-md border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <t.icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════ SAFETY & RISK ═══════ */}
      {activeSection === "risk" && (
        <motion.div key="risk" className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {selected ? (
            <>
              {/* Priority badge */}
              {redFlagActive && priority > 0 && (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                  priority <= 2 ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${getPriorityColor(priority)}`} />
                  <span className={`text-sm font-bold ${getPriorityColor(priority)}`}>
                    {getPriorityLabel(priority)}
                  </span>
                </div>
              )}

              {/* Medical Baseline Alert */}
              {selected.medical_baseline && (
                <div className="p-4 rounded-xl border-2 border-destructive/40 bg-gradient-to-r from-destructive/8 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15">
                      <HeartPulse className="w-5 h-5 text-destructive animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-destructive">Medical Baseline Customer</p>
                      <p className="text-xs text-destructive/70 mt-0.5">Priority safety protocols required</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 ml-[52px]">
                    <ActionButton
                      onClick={() => toast.success(`Doorbell verification dispatched for ${selected.name}`)}
                      variant="destructive"
                      label="🔔 Doorbell Verify"
                    />
                    <ActionButton
                      onClick={() => toast.success(`Priority restoration flagged for ${selected.name}`)}
                      variant="destructive"
                      label="⚡ Priority Restore"
                    />
                  </div>
                </div>
              )}

              {/* Risk Trend Mini */}
              {selected.psps_event_id && (
                <RiskTrendMini circuitId={selected.psps_event_id} label={`${selected.name}'s circuit`} />
              )}

              {/* Risk Forecast + PSPS Impact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AgentRiskForecastPanel customer={selected} />
                <PspsImpactCard customer={selected} />
              </div>

              {/* Safety Modules */}
              <SafetyModules customer={selected} />

              {/* Hazard Report */}
              <ReportHazard customerName={selected.name} />
            </>
          ) : (
            <EmptyState icon={Shield} message="Select a customer to view safety & risk data" />
          )}
        </motion.div>
      )}

      {/* ═══════ SUPPORT & PROGRAMS ═══════ */}
      {activeSection === "support" && (
        <motion.div key="support" className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {selected ? (
            <>
              {/* Customer Profile + Infrastructure */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SectionCard title="Customer Profile" icon={User}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <InfoField label="Name" value={selected.name} />
                    <InfoField label="ZIP" value={selected.zip_code} />
                    <InfoField label="Region" value={selected.region} />
                    <InfoField label="Fire Risk" value={selected.wildfire_risk} color={riskColor(selected.wildfire_risk)} />
                    <InfoField label="HFTD Tier" value={selected.hftd_tier} color={hftdColor(selected.hftd_tier)} />
                    <InfoField label="Medical BL" value={selected.medical_baseline ? "Enrolled" : "No"} color={selected.medical_baseline ? "text-info" : undefined} />
                    <InfoField label="Arrears" value={selected.arrears_status === "Yes" ? `$${selected.arrears_amount}` : "None"} color={selected.arrears_status === "Yes" ? "text-warning" : "text-success"} />
                    <InfoField label="Grid Stress" value={selected.grid_stress_level} color={riskColor(selected.grid_stress_level)} />
                  </div>
                </SectionCard>

                {ss && (
                  <SectionCard title="Serving Infrastructure" icon={Building2} iconColor="text-info">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <InfoField label="Substation" value={ss.name} />
                      <InfoField label="Zone" value={ss.zone} />
                      <InfoField label="Voltage" value={ss.voltage} />
                      <InfoField label="Capacity" value={`${ss.capacityMW} MW`} />
                      <div className="col-span-2">
                        <InfoField
                          label="Status"
                          value={`${ss.status === "Online" ? "🟢" : ss.status === "Reduced" ? "🟡" : "🔴"} ${ss.status}`}
                          color={ss.status === "Online" ? "text-success" : ss.status === "Reduced" ? "text-warning" : "text-destructive"}
                        />
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>

              {/* Programs Eligibility + Local Support */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SectionCard title="Programs & Eligibility" icon={HeartPulse}>
                  <ProgramsEligibilityCard customer={selected} />
                </SectionCard>
                <SectionCard title="Local Support" icon={MapPin}>
                  <LocalSupportCard customer={selected} />
                </SectionCard>
              </div>

              {/* Quick Actions */}
              <SectionCard title="Quick Actions" icon={Zap}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { emoji: "📞", label: "Call Customer", icon: Phone },
                    { emoji: "💰", label: "Apply REACH", icon: DollarSign },
                    { emoji: "⚠️", label: "PSPS Alert", icon: AlertTriangle },
                    { emoji: "📝", label: "Add Note", icon: ClipboardList },
                  ].map((action) => {
                    const done = completedActions.has(action.label);
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.label)}
                        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                          done
                            ? "border-success/40 bg-success/8 text-success"
                            : "border-border bg-card hover:bg-primary/5 hover:border-primary/30 text-foreground hover:shadow-sm"
                        }`}
                      >
                        <span className="text-base">{action.emoji}</span>
                        <span className="truncate">{action.label}</span>
                        {done && <span className="ml-auto text-xs font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {/* AI Chat */}
              <SectionCard title="AI Assistant" icon={Bot} noPadding>
                <div className="px-5 pb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Context: {selected.name}</span>
                </div>
                <div className="h-[420px]">
                  <TabbedChatPanel
                    chatPanel={<AgentChatPanel key={selected.id} customerContext={buildCustomerContext(selected)} />}
                    chatTabLabel={PREDICTIONS_CONFIG.agent.chatTab}
                    predictionsConfig={PREDICTIONS_CONFIG.agent.config}
                    predictionsTabLabel={PREDICTIONS_CONFIG.agent.predictionsTab}
                  />
                </div>
              </SectionCard>

              {/* Agent Notes */}
              <SectionCard title="Agent Notes" icon={ClipboardList}>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this customer…"
                  className="w-full h-24 px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none transition-shadow"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-40 shadow-sm"
                  >
                    {savingNotes ? "Saving…" : "Save Notes"}
                  </button>
                </div>
              </SectionCard>

              {/* Requests */}
              <AgentRequestsPanel />

              {/* Advanced Tools */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SectionCard title="Predictive Outage" icon={Activity}>
                  <PredictiveOutagePanel customers={customers} />
                </SectionCard>
                <SectionCard title="Hardship Triage" icon={DollarSign}>
                  <HardshipTriagePanel
                    customers={customers}
                    onCustomerUpdate={(updated) => {
                      setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                      if (selected?.id === updated.id) setSelected(updated);
                    }}
                  />
                </SectionCard>
              </div>
            </>
          ) : (
            <EmptyState icon={User} message="Select a customer to view support tools" />
          )}
        </motion.div>
      )}

      {/* ═══════ MAP & TRANSPARENCY ═══════ */}
      {activeSection === "map" && (
        <motion.div key="map" className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {selected ? (
            <>
              <SectionCard title="Wildfire Safety Progress Map" icon={Map}>
                <AgentSafetyMapPanel customer={selected} />
              </SectionCard>

              <SectionCard title="Notification History" icon={Radio}>
                <NotificationHistoryCard customer={selected} />
              </SectionCard>

              {/* Original fire map for reference */}
              <SectionCard title="Live Fire Detections" icon={Flame}>
                <div className="rounded-xl border border-border overflow-hidden">
                  <CustomerWildfireMap
                    customerZip={selected.zip_code}
                    assetLat={ss?.latitude ?? 37.20}
                    assetLng={ss?.longitude ?? -119.30}
                    hftdTier={selected.hftd_tier ?? "None"}
                  />
                </div>
              </SectionCard>
            </>
          ) : (
            <EmptyState icon={Map} message="Select a customer to view the wildfire map" />
          )}
        </motion.div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcutsHelp(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Keyboard className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2.5">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.description}</span>
                  <kbd className="px-2.5 py-1 rounded-lg bg-muted border border-border text-xs font-mono font-medium">
                    {s.modifier === "ctrl" ? "Ctrl+" : ""}{s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="mt-5 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable Sub-Components ─────────────── */

function SummaryChip({ icon: Icon, label, value, color, highlight }: {
  icon: React.ElementType; label: string; value: string; color?: string; highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-card transition-colors ${
      highlight ? "border-destructive/30 bg-destructive/5" : "border-border"
    }`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${highlight ? "text-destructive" : "text-muted-foreground"}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <p className={`text-xs font-semibold truncate mt-0.5 ${color ?? "text-card-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children, noPadding }: {
  title: string; icon: React.ElementType; iconColor?: string; children: React.ReactNode; noPadding?: boolean;
}) {
  return (
    <motion.div
      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60">
        <Icon className={`w-4 h-4 ${iconColor ?? "text-primary"}`} />
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      </div>
      <div className={noPadding ? "" : "p-5"}>
        {children}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground gap-3">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted/60">
        <Icon className="w-6 h-6 opacity-50" />
      </div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

function ActionButton({ onClick, variant, label }: { onClick: () => void; variant: "destructive" | "default"; label: string }) {
  const cls = variant === "destructive"
    ? "bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/20"
    : "bg-muted text-foreground border-border hover:bg-muted/80";
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${cls}`}>
      {label}
    </button>
  );
}

function InfoField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${color ?? "text-card-foreground"}`}>{value}</p>
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

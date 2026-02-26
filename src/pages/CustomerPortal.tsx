import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ChatPanel from "@/components/ChatPanel";
import CustomerRequestForms from "@/components/CustomerRequestForms";
import { useCustomer } from "@/hooks/use-customer";
import { buildCustomerContext } from "@/lib/customer-types";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import {
  Zap, Flame, DollarSign, Activity, RefreshCw,
  MapPin, Shield, MessageSquare, FileText, Map,
  Battery, ChevronDown, ChevronUp,
} from "lucide-react";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import TopNav from "@/components/TopNav";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function CustomerPortal() {
  const { customer, setCustomer, setRole, setAgentEmail } = useCustomer();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "map" | "chat" | "services">("home");

  useEffect(() => {
    if (!customer) navigate("/login", { replace: true });
  }, [customer, navigate]);

  const refreshData = useCallback(async () => {
    if (!customer) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer.id)
      .maybeSingle();
    setRefreshing(false);
    if (error || !data) { toast.error("Failed to refresh data"); return; }
    setCustomer(data as unknown as Customer);
    toast.success("Data refreshed");
  }, [customer, setCustomer]);

  if (!customer) return null;

  const c = customer;
  const customerContext = buildCustomerContext(c);
  const outages = c.outage_history
    ? c.outage_history.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

  const riskColor =
    c.wildfire_risk === "High" ? "text-destructive" :
    c.wildfire_risk === "Medium" ? "text-warning" : "text-success";

  const stressColor =
    c.grid_stress_level === "High" ? "text-destructive" :
    c.grid_stress_level === "Medium" ? "text-warning" : "text-info";

  const TABS = [
    { key: "home" as const, label: isMobile ? "Home" : "Dashboard", icon: Activity },
    { key: "map" as const, label: "Map", icon: Map },
    { key: "chat" as const, label: "Help", icon: MessageSquare },
    { key: "services" as const, label: isMobile ? "More" : "Services", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* Compact Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span className="text-exf-blue">Exf</span>
              <span className="text-exf-red">Safe</span>
              <span className="text-exf-blue">Grid</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {c.name} · ZIP {c.zip_code}
            </span>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {/* Mobile: name bar */}
        <div className="flex items-center gap-2 sm:hidden">
          <p className="text-sm text-muted-foreground">
            Hi, <span className="font-semibold text-foreground">{c.name}</span>
          </p>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
            ZIP {c.zip_code}
          </span>
        </div>

        {/* Desktop: welcome */}
        <div className="hidden sm:flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Welcome, <span className="font-semibold text-foreground">{c.name}</span>
          </p>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            ZIP {c.zip_code}
          </span>
        </div>

        {/* Tab Navigation — bottom on mobile, inline on desktop */}
        <div className={`${isMobile ? "fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 py-1 safe-area-bottom" : "flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30"}`}>
          <div className={isMobile ? "flex items-center" : "contents"}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex ${isMobile ? "flex-col" : ""} items-center justify-center gap-1 ${isMobile ? "py-2" : "px-3 py-2"} rounded-md text-xs font-medium transition-colors ${
                  activeTab === t.key
                    ? isMobile ? "text-primary" : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className={`${isMobile ? "w-5 h-5" : "w-3.5 h-3.5"}`} />
                <span className={isMobile ? "text-[10px]" : ""}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content area — add bottom padding on mobile for tab bar */}
        <div className={isMobile ? "pb-20" : ""}>
          {/* ═══ DASHBOARD ═══ */}
          {activeTab === "home" && (
            <div className="space-y-4">
              {/* Risk Card — always first on mobile */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className={`w-4 h-4 ${riskColor}`} />
                  <h3 className="text-sm font-semibold">Fire Risk</h3>
                  <span className={`ml-auto text-sm font-bold ${riskColor}`}>{c.wildfire_risk}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="HFTD Tier" value={c.hftd_tier} />
                  <MiniStat label="Grid Stress" value={c.grid_stress_level} valueColor={stressColor} />
                </div>
              </div>

              {/* PSPS Status Card */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">PSPS Status</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="Phase" value={c.psps_phase || "Restored"} />
                  <MiniStat label="Outage" value={c.current_outage_status || "Normal"} />
                  <MiniStat label="Restoration" value={c.restoration_timer || "N/A"} />
                  <MiniStat label="Nearest CRC" value={c.nearest_crc_location || "N/A"} />
                </div>
              </div>

              {/* My Readiness Card */}
              <ReadinessCard customer={c} />

              {/* Weather advisory */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/30 bg-warning/5">
                <Flame className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">Active Weather Advisory</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Elevated fire weather expected. Consider reducing energy use during peak hours (4–9 PM).
                  </p>
                </div>
              </div>

              {/* Billing & Programs — collapsed on mobile */}
              <CollapsibleCard title="Billing" icon={DollarSign} defaultOpen={!isMobile}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="Bill Trend" value={c.bill_trend} />
                  <MiniStat label="Arrears" value={c.arrears_status === "Yes" ? "Yes" : "No"} />
                  <MiniStat label="Amount" value={c.arrears_status === "Yes" ? `$${c.arrears_amount}` : "$0"} />
                </div>
              </CollapsibleCard>

              <CollapsibleCard title="Programs & History" icon={Shield} defaultOpen={!isMobile}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="Medical Baseline" value={c.medical_baseline ? "Enrolled" : "No"} />
                  <MiniStat label="Digital ACK" value={c.digital_ack_status} />
                  <MiniStat label="Recent Outages" value={outages.length > 0 ? outages.join(", ") : "None"} />
                </div>
              </CollapsibleCard>

              {/* Map preview — hidden on mobile (separate tab) */}
              <div className="hidden sm:block">
                <CustomerWildfireMap customerZip={c.zip_code} />
              </div>
            </div>
          )}

          {/* ═══ MAP ═══ */}
          {activeTab === "map" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Wildfire Activity</h2>
                <span className="text-xs text-muted-foreground ml-auto">ZIP {c.zip_code}</span>
              </div>
              <CustomerWildfireMap customerZip={c.zip_code} />
            </div>
          )}

          {/* ═══ CHAT ═══ */}
          {activeTab === "chat" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">AI Assistant</h2>
              </div>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className={isMobile ? "h-[calc(100vh-220px)]" : "h-[520px]"}>
                  <ChatPanel customerContext={customerContext} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ SERVICES ═══ */}
          {activeTab === "services" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Customer Services</h2>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <CustomerRequestForms customer={customer} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ──────────────────────── */

function MiniStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-muted/40 rounded-md px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${valueColor || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ReadinessCard({ customer: c }: { customer: Customer }) {
  const hasBackup = c.has_portable_battery || c.has_permanent_battery !== "None";
  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-2">
      <div className="flex items-center gap-2">
        <Battery className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">My Readiness</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Portable Battery" value={c.has_portable_battery ? "Yes" : "No"} />
        <MiniStat label="Permanent Battery" value={c.has_permanent_battery} />
        <MiniStat label="Transfer Meter" value={c.has_transfer_meter ? "Yes" : "No"} />
        <MiniStat
          label="Backup Status"
          value={hasBackup ? "Ready" : "Not Set Up"}
          valueColor={hasBackup ? "text-success" : "text-warning"}
        />
      </div>
    </div>
  );
}

function CollapsibleCard({ title, icon: Icon, defaultOpen, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
      >
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

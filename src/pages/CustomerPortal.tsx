import { useEffect, useState, useCallback, useRef } from "react";
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
  Battery, ChevronDown, ChevronUp, Moon, Sun,
  CheckCircle2, Circle, AlertTriangle, Phone, Radio,
} from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import TopNav from "@/components/TopNav";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export default function CustomerPortal() {
  const { customer, setCustomer, setRole, setAgentEmail } = useCustomer();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "map" | "chat" | "services">("home");
  const { dark, toggle } = useDarkMode();

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

  const { pullDistance, isRefreshing: pullRefreshing } = usePullToRefresh({
    onRefresh: refreshData,
    enabled: isMobile,
  });

  useEffect(() => {
    if (!customer) navigate("/login", { replace: true });
  }, [customer, navigate]);


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
    <div className="min-h-screen bg-background relative">
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform"
          style={{ transform: `translateY(${pullDistance - 40}px)` }}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 text-primary ${pullRefreshing ? "animate-spin" : ""}`}
              style={{ transform: pullRefreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>
      )}
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
              onClick={toggle}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
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
              {/* ── HERO 1: Today's Wildfire Risk ── */}
              <div className={`p-5 rounded-xl border-2 space-y-3 ${
                c.wildfire_risk === "High"
                  ? "border-destructive/40 bg-destructive/5"
                  : c.wildfire_risk === "Medium"
                    ? "border-warning/40 bg-warning/5"
                    : "border-success/40 bg-success/5"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    c.wildfire_risk === "High" ? "bg-destructive/15" :
                    c.wildfire_risk === "Medium" ? "bg-warning/15" : "bg-success/15"
                  }`}>
                    <Flame className={`w-5 h-5 ${riskColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Today's Wildfire Risk for You</p>
                    <p className={`text-xl font-bold ${riskColor}`}>{c.wildfire_risk} Risk</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {c.wildfire_risk === "High"
                    ? "Conditions in your area are elevated today. Ensure backup power is ready and review your evacuation plan."
                    : c.wildfire_risk === "Medium"
                      ? "Moderate fire weather is expected. Stay alert for utility notifications and keep devices charged."
                      : "Conditions are favorable today. No immediate fire weather concerns for your area."}
                </p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md bg-muted/60 text-muted-foreground">
                    HFTD {c.hftd_tier}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-muted/60 text-muted-foreground">
                    ZIP {c.zip_code}
                  </span>
                  <span className={`px-2 py-1 rounded-md bg-muted/60 ${stressColor}`}>
                    Grid: {c.grid_stress_level}
                  </span>
                </div>
              </div>

              {/* ── HERO 2: PSPS / EPSS Status ── */}
              <PspsStatusCard customer={c} />

              {/* ── HERO 3: My Wildfire Readiness ── */}
              <ReadinessCard customer={c} />

              {/* ── Secondary content (accordions) ── */}
              <CollapsibleCard title="Billing & Assistance" icon={DollarSign} defaultOpen={!isMobile}>
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

              <CollapsibleCard title="Weather Advisory" icon={Flame} defaultOpen={false}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Elevated fire weather may be expected. Consider reducing energy use during peak hours (4–9 PM) and keep emergency supplies accessible.
                </p>
              </CollapsibleCard>

              {/* Map preview — desktop only */}
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

/* ── PSPS / EPSS Status Hero Card ── */
function PspsStatusCard({ customer: c }: { customer: Customer }) {
  const isActive = c.psps_phase !== "Restored" && c.psps_phase !== "";
  const phaseColor = c.psps_phase === "Shutoff" ? "text-destructive" :
    c.psps_phase === "Warning" ? "text-warning" :
    c.psps_phase === "Watch" ? "text-warning" : "text-success";
  const PhaseIcon = c.psps_phase === "Shutoff" ? Zap :
    c.psps_phase === "Warning" ? AlertTriangle :
    c.psps_phase === "Watch" ? Radio : CheckCircle2;

  return (
    <div className={`p-5 rounded-xl border-2 space-y-3 ${
      isActive ? "border-warning/40 bg-warning/5" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isActive ? "bg-warning/15" : "bg-success/15"
        }`}>
          <PhaseIcon className={`w-5 h-5 ${phaseColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your PSPS / EPSS Status</p>
          <p className={`text-xl font-bold ${phaseColor}`}>{c.psps_phase || "Restored"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Outage Status" value={c.current_outage_status || "Normal"} />
        <MiniStat label="Restoration ETA" value={c.restoration_timer || "N/A"} />
        <MiniStat label="Nearest CRC" value={c.nearest_crc_location || "N/A"} />
        <MiniStat label="Doorbell" value={c.doorbell_status || "Not Needed"} />
      </div>
    </div>
  );
}

/* ── Readiness Steps Hero Card ── */
function ReadinessCard({ customer: c }: { customer: Customer }) {
  const steps = [
    {
      done: c.has_portable_battery || c.has_permanent_battery !== "None",
      label: "Backup power source ready",
      tip: "Get a portable battery or permanent backup to keep essentials running.",
    },
    {
      done: c.medical_baseline,
      label: "Medical Baseline enrolled",
      tip: "If you rely on powered medical equipment, enroll for priority notifications.",
    },
    {
      done: c.digital_ack_status === "Confirmed",
      label: "PSPS alerts acknowledged",
      tip: "Confirm your notification preferences so we can reach you before shutoffs.",
    },
    {
      done: c.has_transfer_meter,
      label: "Transfer meter installed",
      tip: "A transfer meter lets you safely use a generator during outages.",
    },
    {
      done: !!c.nearest_crc_location && c.nearest_crc_location !== "",
      label: "Know your nearest CRC",
      tip: c.nearest_crc_location
        ? `Your nearest Community Resource Center: ${c.nearest_crc_location}`
        : "Find your nearest Community Resource Center for charging and supplies.",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="p-5 rounded-xl border-2 border-border bg-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">My Wildfire Readiness</p>
          <p className="text-sm font-bold text-foreground">{completed} of {steps.length} steps complete</p>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{Math.round((completed / steps.length) * 100)}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
            step.done ? "bg-success/5" : "bg-muted/30"
          }`}>
            {step.done
              ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              : <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className={`text-xs font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{step.tip}</p>
              )}
            </div>
          </div>
        ))}
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

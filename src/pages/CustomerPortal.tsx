import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2 as Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChatPanel from "@/components/ChatPanel";
import TabbedChatPanel from "@/components/TabbedChatPanel";
import { PREDICTIONS_CONFIG } from "@/lib/predictions-config";
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
  Wind, Navigation, ExternalLink, Leaf,
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
            <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold">
              Customer Portal
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
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <MiniStat label="Medical Baseline" value={c.medical_baseline ? "Enrolled" : "No"} />
                    <MiniStat label="Digital ACK" value={c.digital_ack_status} />
                    <MiniStat label="Recent Outages" value={outages.length > 0 ? outages.join(", ") : "None"} />
                  </div>
                  <ProgramEnrollmentButtons customer={c} />
                </div>
              </CollapsibleCard>

              {/* ── Air Quality ── */}
              <AirQualityWidget zip={c.zip_code} />

              {/* ── Nearest Shelter / CRC ── */}
              {c.nearest_crc_location && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Nearest Shelter / CRC</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.nearest_crc_location}</p>
                  <button
                    onClick={() => {
                      const query = encodeURIComponent(c.nearest_crc_location);
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      const url = isIOS
                        ? `maps://maps.apple.com/?q=${query}`
                        : `geo:0,0?q=${query}`;
                      // Try native map intent first, fall back to Google Maps web
                      const w = window.open(url, "_blank");
                      if (!w || w.closed) {
                        window.open(`https://maps.google.com/maps?q=${query}`, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    <MapPin className="w-3 h-3" /> Get Directions
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              <CollapsibleCard title="Weather Advisory" icon={Flame} defaultOpen={false}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Elevated fire weather may be expected. Consider reducing energy use during peak hours (4–9 PM) and keep emergency supplies accessible.
                </p>
              </CollapsibleCard>

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
              <div className={isMobile ? "h-[calc(100vh-220px)]" : "h-[520px]"}>
                <TabbedChatPanel
                  chatPanel={<ChatPanel customerContext={customerContext} />}
                  chatTabLabel={PREDICTIONS_CONFIG.customer.chatTab}
                  predictionsConfig={PREDICTIONS_CONFIG.customer.config}
                  predictionsTabLabel={PREDICTIONS_CONFIG.customer.predictionsTab}
                />
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

/* ── Readiness Steps Hero Card (Interactive) ── */
function ReadinessCard({ customer: c }: { customer: Customer }) {
  const { setCustomer } = useCustomer();
  const [updating, setUpdating] = useState<string | null>(null);

  interface ReadinessStep {
    key: string;
    done: boolean;
    label: string;
    actionLabel: string;
    tip: string;
    field: string;
    value: any;
  }

  const steps: ReadinessStep[] = [
    {
      key: "backup",
      done: c.has_portable_battery || c.has_permanent_battery !== "None",
      label: "Backup power source ready",
      actionLabel: "I have a backup battery",
      tip: "Get a portable battery or permanent backup to keep essentials running.",
      field: "has_portable_battery",
      value: true,
    },
    {
      key: "medical",
      done: c.medical_baseline,
      label: "Medical Baseline enrolled",
      actionLabel: "Enroll in Medical Baseline",
      tip: "If you rely on powered medical equipment, enroll for priority notifications.",
      field: "medical_baseline",
      value: true,
    },
    {
      key: "ack",
      done: c.digital_ack_status === "Confirmed",
      label: "PSPS alerts acknowledged",
      actionLabel: "Confirm my alerts",
      tip: "Confirm your notification preferences so we can reach you before shutoffs.",
      field: "digital_ack_status",
      value: "Confirmed",
    },
    {
      key: "transfer",
      done: c.has_transfer_meter,
      label: "Transfer meter installed",
      actionLabel: "I have a transfer meter",
      tip: "A transfer meter lets you safely use a generator during outages.",
      field: "has_transfer_meter",
      value: true,
    },
    {
      key: "crc",
      done: !!c.nearest_crc_location && c.nearest_crc_location !== "",
      label: "Know your nearest CRC",
      actionLabel: "",
      tip: c.nearest_crc_location
        ? `Your nearest Community Resource Center: ${c.nearest_crc_location}`
        : "Find your nearest Community Resource Center for charging and supplies.",
      field: "",
      value: null,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  const handleToggle = async (step: ReadinessStep) => {
    if (!step.field) return;
    setUpdating(step.key);
    const newValue = step.done
      ? (typeof step.value === "boolean" ? false : step.field === "digital_ack_status" ? "Sent" : "None")
      : step.value;

    const { error } = await supabase
      .from("customers")
      .update({ [step.field]: newValue })
      .eq("id", c.id);

    if (error) {
      toast.error("Failed to update");
    } else {
      // Refresh customer data
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("id", c.id)
        .maybeSingle();
      if (data) setCustomer(data as unknown as Customer);
      toast.success(step.done ? `"${step.label}" unmarked` : `"${step.label}" marked complete!`);
    }
    setUpdating(null);
  };

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
        {steps.map((step) => {
          const isToggleable = !!step.field;
          const isUpdating = updating === step.key;
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                step.done ? "bg-success/5" : "bg-muted/30"
              } ${isToggleable ? "cursor-pointer hover:bg-muted/50" : ""}`}
              onClick={() => isToggleable && !isUpdating && handleToggle(step)}
              role={isToggleable ? "button" : undefined}
              tabIndex={isToggleable ? 0 : undefined}
            >
              {isUpdating ? (
                <Loader2Icon className="w-4 h-4 text-primary animate-spin flex-shrink-0 mt-0.5" />
              ) : step.done ? (
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.tip}</p>
                )}
              </div>
              {isToggleable && !isUpdating && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  step.done
                    ? "bg-success/10 text-success"
                    : "bg-primary/10 text-primary"
                }`}>
                  {step.done ? "Undo" : "Mark done"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Program Enrollment Buttons ── */
function ProgramEnrollmentButtons({ customer: c }: { customer: Customer }) {
  const { setCustomer } = useCustomer();
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const programs = [
    {
      key: "medical_baseline",
      label: "Medical Baseline",
      enrolled: c.medical_baseline,
      field: "medical_baseline",
      value: true,
      unValue: false,
      desc: "Priority notifications & restoration for medical equipment users",
      icon: "🏥",
    },
    {
      key: "backup_power",
      label: "Backup Power Program",
      enrolled: c.has_portable_battery || c.has_permanent_battery !== "None",
      field: "has_portable_battery",
      value: true,
      unValue: false,
      desc: "Get a portable battery or permanent backup at reduced cost",
      icon: "🔋",
    },
    {
      key: "demand_response",
      label: "Demand Response",
      enrolled: c.demand_response_enrolled,
      field: "demand_response_enrolled",
      value: true,
      unValue: false,
      desc: "Earn credits by reducing usage during peak hours",
      icon: "🌱",
    },
  ];

  const handleEnroll = async (prog: typeof programs[0]) => {
    if (!prog.field) {
      toast.info("Opening enrollment form…");
      return;
    }
    setEnrolling(prog.key);
    const newVal = prog.enrolled ? prog.unValue : prog.value;
    const { error } = await supabase
      .from("customers")
      .update({ [prog.field]: newVal })
      .eq("id", c.id);

    if (!error) {
      const { data } = await supabase.from("customers").select("*").eq("id", c.id).maybeSingle();
      if (data) setCustomer(data as unknown as Customer);
      toast.success(prog.enrolled ? `Unenrolled from ${prog.label}` : `Enrolled in ${prog.label}!`);
    } else {
      toast.error("Failed to update enrollment");
    }
    setEnrolling(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Quick Enrollment</p>
      {programs.map((prog) => (
        <div key={prog.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
          <span className="text-lg">{prog.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{prog.label}</p>
            <p className="text-[10px] text-muted-foreground">{prog.desc}</p>
          </div>
          <button
            onClick={() => handleEnroll(prog)}
            disabled={enrolling === prog.key}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              prog.enrolled
                ? "bg-success/10 text-success hover:bg-success/20"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            } disabled:opacity-40`}
          >
            {enrolling === prog.key ? "…" : prog.enrolled ? "Enrolled ✓" : "Enroll"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Air Quality Widget ── */
function AirQualityWidget({ zip }: { zip: string }) {
  const [aq, setAq] = useState<{
    aqi: number; level: string; color: string; advice: string;
    pm2_5: number | null; pm10: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/air-quality?zip=${encodeURIComponent(zip)}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
        );
        if (res.ok) {
          const d = await res.json();
          setAq(d);
        }
      } catch {}
      setLoading(false);
    })();
  }, [zip]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-2">
        <Loader2Icon className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading air quality…</span>
      </div>
    );
  }

  if (!aq) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Wind className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Air Quality</span>
        <span className="ml-auto text-xs text-muted-foreground">ZIP {zip}</span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: aq.color }}
        >
          {aq.aqi}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ color: aq.color }}>{aq.level}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{aq.advice}</p>
        </div>
      </div>
      {(aq.pm2_5 !== null || aq.pm10 !== null) && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {aq.pm2_5 !== null && <span>PM2.5: <strong className="text-foreground">{aq.pm2_5} µg/m³</strong></span>}
          {aq.pm10 !== null && <span>PM10: <strong className="text-foreground">{aq.pm10} µg/m³</strong></span>}
        </div>
      )}
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

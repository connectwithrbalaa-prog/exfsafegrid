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
} from "lucide-react";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import TopNav from "@/components/TopNav";
import { toast } from "sonner";

export default function CustomerPortal() {
  const { customer, setCustomer, setRole, setAgentEmail } = useCustomer();
  const navigate = useNavigate();
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
    if (error || !data) {
      toast.error("Failed to refresh data");
      return;
    }
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
    { key: "home" as const, label: "Dashboard", icon: Activity },
    { key: "map" as const, label: "Risk Map", icon: Map },
    { key: "chat" as const, label: "Get Help", icon: MessageSquare },
    { key: "services" as const, label: "Services", icon: FileText },
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
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Welcome + Quick Stats */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Welcome, <span className="font-semibold text-foreground">{c.name}</span>
            </p>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              ZIP {c.zip_code}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Flame} label="Fire Risk" value={c.wildfire_risk} color={riskColor} />
            <StatCard icon={Activity} label="Grid Stress" value={c.grid_stress_level} color={stressColor} />
            <StatCard
              icon={DollarSign}
              label="Balance"
              value={c.arrears_status === "Yes" ? `$${c.arrears_amount}` : "$0"}
              color={c.arrears_status === "Yes" ? "text-warning" : "text-success"}
            />
            <StatCard icon={Shield} label="HFTD" value={c.hftd_tier} color="text-muted-foreground" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {activeTab === "home" && (
          <div className="space-y-4">
            {/* Active Alert */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-warning/30 bg-warning/5">
              <Flame className="w-4 h-4 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Active Weather Advisory</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Elevated fire weather expected in Northern zones through Friday. Consider reducing energy use during peak hours (4–9 PM).
                </p>
              </div>
            </div>

            {/* Detail Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard title="Wildfire Risk" icon={Flame} color="text-destructive">
                <InfoRow label="Risk Level" value={c.wildfire_risk} />
                <InfoRow label="HFTD Tier" value={c.hftd_tier} />
                <InfoRow label="Recent Outages" value={outages.length > 0 ? outages.join(", ") : "None"} />
              </InfoCard>

              <InfoCard title="Billing" icon={DollarSign} color="text-warning">
                <InfoRow label="Bill Trend" value={c.bill_trend} />
                <InfoRow label="Arrears" value={c.arrears_status === "Yes" ? "Yes" : "No"} />
                <InfoRow label="Amount" value={c.arrears_status === "Yes" ? `$${c.arrears_amount}` : "$0"} />
              </InfoCard>

              <InfoCard title="Grid Status" icon={Activity} color="text-info">
                <InfoRow label="Stress Level" value={c.grid_stress_level} />
                <InfoRow label="Outage Status" value={c.current_outage_status || "Normal"} />
                <InfoRow label="PSPS Phase" value={c.psps_phase || "None"} />
              </InfoCard>
            </div>

            {/* Compact Map Preview */}
            <CustomerWildfireMap customerZip={c.zip_code} />
          </div>
        )}

        {/* ═══ MAP ═══ */}
        {activeTab === "map" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Wildfire Activity Near You</h2>
              <span className="text-xs text-muted-foreground">ZIP {c.zip_code}</span>
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
              <span className="text-xs text-muted-foreground ml-auto">Ask about power, bills, or wildfire safety</span>
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="h-[520px]">
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
            <div className="rounded-lg border border-border bg-card p-5">
              <CustomerRequestForms customer={customer} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Sub-components ──────────────────────── */

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ title, icon: Icon, color, children }: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-xs font-semibold text-card-foreground">{title}</h3>
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium text-card-foreground text-xs">{value}</dd>
    </div>
  );
}

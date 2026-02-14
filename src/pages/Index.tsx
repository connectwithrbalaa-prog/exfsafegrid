import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ChatPanel from "@/components/ChatPanel";
import CustomerRequestForms from "@/components/CustomerRequestForms";
import AgentView from "@/components/AgentView";
import StatusBar from "@/components/StatusBar";
import { useCustomer } from "@/hooks/use-customer";
import { buildCustomerContext } from "@/lib/customer-types";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { Zap, Flame, DollarSign, Activity, LogOut, RefreshCw, Presentation } from "lucide-react";
import PspsStatusHeader from "@/components/PspsStatusHeader";
import CustomerWildfireMap from "@/components/CustomerWildfireMap";
import { toast } from "sonner";

const Index = () => {
  const { customer, setCustomer, role, setRole, agentEmail, setAgentEmail } = useCustomer();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Agents don't need a customer record; customers do
    if (role === "customer" && !customer) navigate("/login");
    if (role === "agent" && !customer) { /* agent is fine without customer */ }
  }, [customer, role, navigate]);

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

  if (role === "customer" && !customer) return null;

  // Agent view — no customer needed
  if (role === "agent") {
    return (
      <div className="min-h-screen bg-background pt-[72px]">
        <PspsStatusHeader />
        <header className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight"><span className="text-exf-blue">Exf</span><span className="text-exf-red">Safe</span><span className="text-exf-blue">Grid</span></span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Agent</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/demo")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Presentation className="w-3.5 h-3.5" />
                Demo Deck
              </button>
              <button
                onClick={() => navigate("/command-center")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Flame className="w-3.5 h-3.5" />
                Command Center
              </button>
              <button
                onClick={() => { setCustomer(null); setRole("customer"); setAgentEmail(null); navigate("/login"); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AgentView agentEmail={agentEmail || undefined} />
        </main>
      </div>
    );
  }

  // Customer view
  const customerContext = buildCustomerContext(customer!);

  const outages = customer!.outage_history
    ? customer!.outage_history.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

  const c = customer!;

  const infoCards = [
    {
      icon: Flame,
      title: "Wildfire Risk",
      color: "text-destructive",
      details: [
        { label: "Risk Level", value: customer.wildfire_risk },
        { label: "ZIP Code", value: customer.zip_code },
        { label: "Recent Outages", value: outages.length > 0 ? outages.join(", ") : "None" },
      ],
    },
    {
      icon: DollarSign,
      title: "Bill & Assistance",
      color: "text-warning",
      details: [
        { label: "Bill Trend", value: customer.bill_trend },
        { label: "Arrears", value: customer.arrears_status === "Yes" ? "Yes" : "No" },
        { label: "Amount Due", value: customer.arrears_status === "Yes" ? `$${customer.arrears_amount}` : "$0" },
      ],
    },
    {
      icon: Activity,
      title: "Grid Stress",
      color: "text-info",
      details: [
        { label: "Stress Level", value: customer.grid_stress_level },
        { label: "ZIP Code", value: customer.zip_code },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight"><span className="text-exf-blue">Exf</span><span className="text-exf-red">Safe</span><span className="text-exf-blue">Grid</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh My Data"}
            </button>
            <button
              onClick={() => { setCustomer(null); setRole("customer"); setAgentEmail(null); navigate("/login"); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <StatusBar customer={customer!} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {infoCards.map((card) => (
            <div key={card.title} className="p-5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <card.icon className={`w-5 h-5 ${card.color}`} />
                <h2 className="text-sm font-semibold text-card-foreground">{card.title}</h2>
              </div>
              <dl className="space-y-1.5">
                {card.details.map((d) => (
                  <div key={d.label} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd className="font-medium text-card-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Wildfire Map */}
        <CustomerWildfireMap customerZip={customer!.zip_code} />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-semibold text-card-foreground mb-3">Quick Links</h2>
              <CustomerRequestForms customer={customer!} />
            </div>

            <div className="p-5 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-semibold text-card-foreground mb-2">⚠️ Active Alert</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Elevated fire weather expected in Northern zones through Friday.
                Consider reducing non-essential energy use during peak hours (4–9 PM).
              </p>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <p className="text-sm text-muted-foreground px-1">
              Ask any question about your power, bills, or wildfire safety.
            </p>
            <div className="h-[520px]">
              <ChatPanel customerContext={customerContext} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

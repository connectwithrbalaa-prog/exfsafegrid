import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer, type UserRole } from "@/hooks/use-customer";
import type { Customer } from "@/lib/customer-types";
import { Zap, LogIn, User, Headset, Shield, HardHat } from "lucide-react";
import { toast } from "sonner";

type Tab = "customer" | "agent" | "executive" | "field";

const DEMO_PASSWORD = "Demo1234!";

const AGENT_NAMES = [
  { name: "Agent Smith", email: "agent.smith@exfsafegrid.com" },
  { name: "Agent Rivera", email: "agent.rivera@exfsafegrid.com" },
  { name: "Agent Chen", email: "agent.chen@exfsafegrid.com" },
];

const EXECUTIVE_NAMES = [
  { name: "Dir. Martinez", email: "martinez@exfsafegrid.com" },
  { name: "VP Operations", email: "vp.ops@exfsafegrid.com" },
];

const FIELD_NAMES = [
  { name: "Crew Lead Torres", email: "torres@exfsafegrid.com" },
  { name: "Patroller Kim", email: "kim@exfsafegrid.com" },
];

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "customer", label: "Customer", icon: User },
  { key: "agent", label: "Agent", icon: Headset },
  { key: "executive", label: "Executive", icon: Shield },
  { key: "field", label: "Field Crew", icon: HardHat },
];

const ROLE_HOME: Record<Tab, string> = {
  customer: "/customer",
  agent: "/agent",
  executive: "/command-center",
  field: "/field-crew",
};

export default function Login() {
  const [tab, setTab] = useState<Tab>("customer");
  const [selectedName, setSelectedName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { setCustomer, setRole, setAgentEmail } = useCustomer();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setCustomers(data as unknown as Customer[]);
      });
  }, []);

  const getReferenceList = () => {
    switch (tab) {
      case "customer": return customers.map((c) => ({ name: c.name }));
      case "agent": return AGENT_NAMES;
      case "executive": return EXECUTIVE_NAMES;
      case "field": return FIELD_NAMES;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== DEMO_PASSWORD) {
      toast.error("Invalid demo password");
      return;
    }

    const trimmed = selectedName.trim().toLowerCase();

    if (tab === "customer") {
      const c = customers.find((c) => c.name.toLowerCase() === trimmed);
      if (!c) { toast.error("Customer not found"); return; }
      setCustomer(c);
      setRole("customer");
      setAgentEmail(null);
      toast.success(`Signed in as ${c.name}`);
    } else if (tab === "agent") {
      const agent = AGENT_NAMES.find((a) => a.name.toLowerCase() === trimmed);
      if (!agent) { toast.error("Agent not found"); return; }
      setCustomer(null);
      setRole("agent");
      setAgentEmail(agent.email);
      toast.success(`Signed in as ${agent.name}`);
    } else if (tab === "executive") {
      const exec = EXECUTIVE_NAMES.find((a) => a.name.toLowerCase() === trimmed);
      if (!exec) { toast.error("Executive not found"); return; }
      setCustomer(null);
      setRole("executive");
      setAgentEmail(exec.email);
      toast.success(`Signed in as ${exec.name}`);
    } else {
      const crew = FIELD_NAMES.find((a) => a.name.toLowerCase() === trimmed);
      if (!crew) { toast.error("Field crew not found"); return; }
      setCustomer(null);
      setRole("field");
      setAgentEmail(crew.email);
      toast.success(`Signed in as ${crew.name}`);
    }

    navigate(ROLE_HOME[tab]);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ExfSafeGrid</h1>
          <p className="text-sm text-muted-foreground">Select your demo account</p>
        </div>

        {/* Role tabs – 4 columns */}
        <div className="grid grid-cols-4 rounded-lg border border-border bg-muted p-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedName(""); }}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="demo-name" className="text-sm font-medium text-foreground">
              {TABS.find((t) => t.key === tab)?.label} Name
            </label>
            <input
              id="demo-name"
              type="text"
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              placeholder={`Enter ${tab} name`}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Demo Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter demo password"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </form>

        {/* Reference logins */}
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <p className="text-xs font-medium text-foreground">
            {TABS.find((t) => t.key === tab)?.label} Logins
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {getReferenceList().map((item) => (
              <p key={item.name} className="text-xs text-muted-foreground font-mono">
                {item.name}
              </p>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Password: <span className="font-mono text-foreground">Demo1234!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

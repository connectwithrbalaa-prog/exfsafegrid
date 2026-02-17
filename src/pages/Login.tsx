import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import type { Customer } from "@/lib/customer-types";
import { Zap, LogIn, User, Headset } from "lucide-react";
import { toast } from "sonner";

type Tab = "customer" | "agent";

const DEMO_PASSWORD = "Demo1234!";

const AGENT_NAMES = [
  { name: "Agent Smith", email: "agent.smith@exfsafegrid.com" },
  { name: "Agent Rivera", email: "agent.rivera@exfsafegrid.com" },
  { name: "Agent Chen", email: "agent.chen@exfsafegrid.com" },
];

export default function Login() {
  const [tab, setTab] = useState<Tab>("customer");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== DEMO_PASSWORD) {
      toast.error("Invalid demo password");
      return;
    }

    if (tab === "customer") {
      const c = customers.find((c) => c.name.toLowerCase() === selectedCustomer.trim().toLowerCase());
      if (!c) {
        toast.error("Customer not found. Check the reference list below.");
        return;
      }
      setCustomer(c);
      setRole("customer");
      setAgentEmail(null);
      toast.success(`Signed in as ${c.name}`);
      navigate("/");
    } else {
      const agent = AGENT_NAMES.find((a) => a.name.toLowerCase() === selectedAgent.trim().toLowerCase());
      if (!agent) {
        toast.error("Agent not found. Check the reference list below.");
        return;
      }
      setCustomer(null);
      setRole("agent");
      setAgentEmail(agent.email);
      toast.success(`Signed in as ${agent.name}`);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ExfSafeGrid</h1>
          <p className="text-sm text-muted-foreground">Select your demo account</p>
        </div>

        {/* Role tabs */}
        <div className="flex rounded-lg border border-border bg-muted p-1 gap-1">
          {([
            { key: "customer" as const, label: "Customer", icon: User },
            { key: "agent" as const, label: "Agent", icon: Headset },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-4">
          {tab === "customer" ? (
            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="text-sm font-medium text-foreground">
                Customer Name
              </label>
              <input
                id="customer-name"
                type="text"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                placeholder="Enter customer name"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="agent-name" className="text-sm font-medium text-foreground">
                Agent Name
              </label>
              <input
                id="agent-name"
                type="text"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                placeholder="Enter agent name"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          )}

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
          <p className="text-xs font-medium text-foreground">Reference Logins</p>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Customers:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {customers.map((c) => (
                <p key={c.id} className="text-xs text-muted-foreground font-mono">
                  {c.name} — {c.zip_code}
                </p>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agents:</p>
            {AGENT_NAMES.map((a) => (
              <p key={a.email} className="text-xs text-muted-foreground font-mono">
                {a.name}
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

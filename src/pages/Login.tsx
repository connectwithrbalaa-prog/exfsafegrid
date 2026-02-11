import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer, type UserRole } from "@/hooks/use-customer";
import type { Customer } from "@/lib/customer-types";
import { AGENT_REGIONS } from "@/lib/region-utils";
import { Zap, LogIn, User, Headset } from "lucide-react";
import { toast } from "sonner";

const DEMO_PASSWORD = "demo123";
const AGENT_PASSWORD = "agent123";

const DEMO_AGENTS = Object.entries(AGENT_REGIONS).map(([email, region]) => ({
  name: email.split("@")[0].split(".").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  email,
  region,
}));

export default function Login() {
  const [tab, setTab] = useState<UserRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setCustomer, setRole, setAgentEmail } = useCustomer();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (tab === "agent") {
      if (password !== AGENT_PASSWORD) {
        toast.error("Invalid agent password. Hint: use agent123");
        return;
      }
      // Agent login doesn't need a customer record — just set role and go
      setRole("agent");
      setAgentEmail(email.trim().toLowerCase());
      setCustomer(null);
      navigate("/");
      return;
    }

    // Customer login
    if (password !== DEMO_PASSWORD) {
      toast.error("Invalid password. Hint: use demo123");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .ilike("email", email.trim())
      .maybeSingle();
    setLoading(false);

    if (error || !data) {
      toast.error("No customer found with that email.");
      return;
    }

    setCustomer(data as unknown as Customer);
    setRole("customer");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">GridGuard</h1>
          <p className="text-sm text-muted-foreground">Sign in to your dashboard</p>
        </div>

        {/* Role tabs */}
        <div className="flex rounded-lg border border-border bg-muted p-1 gap-1">
          {([
            { key: "customer" as const, label: "Customer", icon: User },
            { key: "agent" as const, label: "Agent", icon: Headset },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setEmail(""); setPassword(""); }}
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

        {/* Login form */}
        <form onSubmit={handleLogin} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tab === "customer" ? "e.g. maria.gonzalez@example.com" : "e.g. agent.smith@gridguard.com"}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
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
            {loading ? "Signing in…" : `Sign In as ${tab === "customer" ? "Customer" : "Agent"}`}
          </button>
        </form>

        {/* Demo hint */}
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          {tab === "customer" ? (
            <>
              <p className="text-xs font-medium text-foreground">Demo Customer Accounts</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>maria.gonzalez@example.com</li>
                <li>john.smith@example.com</li>
                <li>priya.patel@example.com</li>
                <li>david.kim@example.com</li>
                <li>sarah.johnson@example.com</li>
              </ul>
              <p className="text-xs text-muted-foreground">Password: <span className="font-mono text-foreground">demo123</span></p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-foreground">Demo Agent Accounts</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {DEMO_AGENTS.map((a) => (
                  <li key={a.email}>{a.email} <span className="text-foreground/50">({a.region})</span></li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Password: <span className="font-mono text-foreground">agent123</span></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

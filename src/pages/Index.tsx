import { useNavigate } from "react-router-dom";
import { Zap, User, Headset, Shield, HardHat } from "lucide-react";

const PERSONAS = [
  { key: "customer" as const, label: "Customer Portal", desc: "View your account, outages & wildfire risk", icon: User, path: "/customer" },
  { key: "agent" as const, label: "Agent Desktop", desc: "Manage customers, alerts & operations", icon: Headset, path: "/agent" },
  { key: "executive" as const, label: "Command Center", desc: "Executive EOC dashboard & analytics", icon: Shield, path: "/command-center" },
  { key: "field" as const, label: "Field Crew", desc: "Patrol checklists, hazard reports & GPS", icon: HardHat, path: "/field-crew" },
] as const;

export default function Index() {
  const navigate = useNavigate();

  // No auto-redirect — always show persona chooser on "/"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ExfSafeGrid</h1>
          <p className="text-sm text-muted-foreground">Choose your view</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => navigate(`/login?role=${p.key}`)}
              className="flex flex-col items-start gap-2 p-5 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <p.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-card-foreground">{p.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

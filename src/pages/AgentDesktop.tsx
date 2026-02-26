import { useNavigate } from "react-router-dom";
import AgentView from "@/components/AgentView";
import { useCustomer } from "@/hooks/use-customer";
import { LogOut, Presentation, HardHat } from "lucide-react";
import PspsStatusHeader from "@/components/PspsStatusHeader";
import TopNav from "@/components/TopNav";

export default function AgentDesktop() {
  const { setCustomer, setRole, agentEmail, setAgentEmail } = useCustomer();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-[60px] md:pt-[68px] lg:pt-[72px]">
      <PspsStatusHeader />
      <TopNav />
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 flex items-center justify-between h-10">
          <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Agent</span>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => navigate("/demo")}
              className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Presentation className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Demo Deck</span>
            </button>
            <button
              onClick={() => navigate("/field-crew")}
              className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <HardHat className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Field Crew</span>
            </button>
            <button
              onClick={() => { setCustomer(null); setRole("customer"); setAgentEmail(null); navigate("/login"); }}
              className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 md:py-6">
        <AgentView agentEmail={agentEmail || undefined} />
      </main>
    </div>
  );
}

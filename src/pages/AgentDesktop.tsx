import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AgentView from "@/components/AgentView";
import { useCustomer } from "@/hooks/use-customer";
import { Presentation, HardHat, Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import PspsStatusHeader from "@/components/PspsStatusHeader";
import TopNav from "@/components/TopNav";

export default function AgentDesktop() {
  const { setCustomer, setRole, agentEmail, setAgentEmail } = useCustomer();
  const navigate = useNavigate();
  const { dark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-background pt-[60px] md:pt-[68px] lg:pt-[72px]">
      <PspsStatusHeader />
      <TopNav />
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-11">
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold">
              Agent Desktop
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
            </button>
            <button
              onClick={() => navigate("/demo")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Demo</span>
            </button>
            <button
              onClick={() => navigate("/field-crew")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] md:text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <HardHat className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Field</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-7">
        <AgentView agentEmail={agentEmail || undefined} />
      </main>
    </div>
  );
}

import ChatPanel from "@/components/ChatPanel";
import StatusBar from "@/components/StatusBar";
import { Zap } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">GridGuard</span>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">Utility Intelligence Dashboard</p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <StatusBar />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Info panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-semibold text-card-foreground mb-3">Quick Links</h2>
              <ul className="space-y-2">
                {[
                  "Report an outage",
                  "View my bill",
                  "Apply for assistance",
                  "Wildfire safety tips",
                  "Demand response enrollment",
                ].map((item) => (
                  <li key={item}>
                    <button className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-secondary text-foreground transition-colors">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-semibold text-card-foreground mb-2">⚠️ Active Alert</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Elevated fire weather expected in Northern zones through Friday.
                Consider reducing non-essential energy use during peak hours (4–9 PM).
              </p>
            </div>
          </div>

          {/* Chat panel */}
          <div className="lg:col-span-3 h-[520px]">
            <ChatPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

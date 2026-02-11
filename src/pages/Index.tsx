import ChatPanel from "@/components/ChatPanel";
import StatusBar from "@/components/StatusBar";
import { mockCustomer, buildCustomerContext } from "@/lib/mock-customer";
import { Zap, Flame, DollarSign, Activity } from "lucide-react";

const customerContext = buildCustomerContext(mockCustomer);

const infoCards = [
  {
    icon: Flame,
    title: "Wildfire Risk",
    color: "text-destructive",
    description:
      "Your area is classified as high wildfire risk. The utility uses EPSS and PSPS shutoffs during extreme fire weather to protect communities. Undergrounding and system hardening are underway to reduce future outages.",
  },
  {
    icon: DollarSign,
    title: "Bill & Assistance",
    color: "text-warning",
    description:
      "Your current bill is $187/mo with a past-due balance of $342. You may qualify for REACH or Match My Payment assistance programs to help manage costs.",
  },
  {
    icon: Activity,
    title: "Grid Stress",
    color: "text-info",
    description:
      "Grid stress is currently elevated due to increased demand. Consider shifting energy use outside peak hours (4–9 PM) and enrolling in demand response programs.",
  },
];

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
        <StatusBar customer={mockCustomer} />

        {/* Three info cards in a row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {infoCards.map((card) => (
            <div key={card.title} className="p-5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`w-5 h-5 ${card.color}`} />
                <h2 className="text-sm font-semibold text-card-foreground">{card.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Chat panel on the right, quick links on the left */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left sidebar */}
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

          {/* Chat panel — right side */}
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

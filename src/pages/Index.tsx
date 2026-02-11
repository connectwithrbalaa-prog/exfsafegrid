import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatPanel from "@/components/ChatPanel";
import StatusBar from "@/components/StatusBar";
import { useCustomer } from "@/hooks/use-customer";
import { buildCustomerContext } from "@/lib/customer-types";
import { Zap, Flame, DollarSign, Activity, LogOut } from "lucide-react";

const Index = () => {
  const { customer, setCustomer } = useCustomer();
  const navigate = useNavigate();

  useEffect(() => {
    if (!customer) navigate("/login");
  }, [customer, navigate]);

  if (!customer) return null;

  const customerContext = buildCustomerContext(customer);

  const infoCards = [
    {
      icon: Flame,
      title: "Wildfire Risk",
      color: "text-destructive",
      description:
        customer.wildfire_risk === "High"
          ? "Your area is classified as high wildfire risk. The utility uses EPSS and PSPS shutoffs during extreme fire weather. Undergrounding and system hardening are underway."
          : customer.wildfire_risk === "Medium"
          ? "Your area has moderate wildfire risk. Stay informed about fire weather alerts and have an emergency plan ready."
          : "Your area has low wildfire risk. Standard safety protocols are in place.",
    },
    {
      icon: DollarSign,
      title: "Bill & Assistance",
      color: "text-warning",
      description:
        customer.arrears_status === "Yes"
          ? `You have a past-due balance of $${customer.arrears_amount}. You may qualify for REACH or Match My Payment assistance programs.`
          : "Your account is current. Keep up the great work managing your energy costs!",
    },
    {
      icon: Activity,
      title: "Grid Stress",
      color: "text-info",
      description:
        customer.grid_stress_level === "High"
          ? "Grid stress is currently high. Consider shifting energy use outside peak hours (4–9 PM) and enrolling in demand response programs."
          : customer.grid_stress_level === "Medium"
          ? "Grid stress is moderate. Be mindful of peak-hour usage to help stabilize the grid."
          : "Grid stress is low. Normal operations are in effect.",
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
            <span className="text-lg font-bold text-foreground tracking-tight">GridGuard</span>
          </div>
          <button
            onClick={() => { setCustomer(null); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch Customer
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <StatusBar customer={customer} />

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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-semibold text-card-foreground mb-3">Quick Links</h2>
              <ul className="space-y-2">
                {["Report an outage", "View my bill", "Apply for assistance", "Wildfire safety tips", "Demand response enrollment"].map((item) => (
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

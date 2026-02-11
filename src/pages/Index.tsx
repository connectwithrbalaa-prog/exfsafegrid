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

  const outages = customer.outage_history
    ? customer.outage_history.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

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

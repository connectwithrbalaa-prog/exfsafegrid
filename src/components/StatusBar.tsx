import { Flame, Thermometer, DollarSign, AlertTriangle } from "lucide-react";
import type { Customer } from "@/lib/customer-types";

interface StatusBarProps {
  customer: Customer;
}

export default function StatusBar({ customer }: StatusBarProps) {
  const riskColor =
    customer.wildfire_risk === "High" ? "text-destructive" :
    customer.wildfire_risk === "Medium" ? "text-warning" : "text-success";

  const stressColor =
    customer.grid_stress_level === "High" ? "text-destructive" :
    customer.grid_stress_level === "Medium" ? "text-warning" : "text-info";

  const arrearsColor = customer.arrears_status === "Yes" ? "text-warning" : "text-success";

  const stats = [
    { icon: Flame, label: "Fire Risk", value: customer.wildfire_risk, color: riskColor },
    { icon: Thermometer, label: "Grid Stress", value: customer.grid_stress_level, color: stressColor },
    { icon: DollarSign, label: "Arrears", value: customer.arrears_status === "Yes" ? `$${customer.arrears_amount}` : "None", color: arrearsColor },
    { icon: AlertTriangle, label: "Bill Trend", value: customer.bill_trend, color: "text-info" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <p className="text-sm text-muted-foreground">
          Welcome, <span className="font-semibold text-foreground">{customer.name}</span> · ZIP {customer.zip_code}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className="text-lg font-bold text-card-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

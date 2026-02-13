import { Flame, Thermometer, DollarSign, AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const tooltips = {
    "Fire Risk": "Static risk level based on HFTD tier (High Fire-Threat District classification). Updated infrequently.",
    "Grid Stress": "Current grid demand level. Grid Stress is independent of fire risk.",
    "Arrears": "Outstanding bill amount. Financial vulnerability indicator for outreach prioritization.",
    "Bill Trend": "Recent bill trend pattern based on historical usage.",
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <p className="text-sm text-muted-foreground">
            Welcome, <span className="font-semibold text-foreground">{customer.name}</span> · ZIP {customer.zip_code}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card cursor-help hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <p className="text-lg font-bold text-card-foreground">{s.value}</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltips[s.label as keyof typeof tooltips] || "Customer data metric"}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

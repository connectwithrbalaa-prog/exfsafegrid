import { Flame, Zap, Thermometer, Shield } from "lucide-react";

const stats = [
  { icon: Flame, label: "Fire Risk", value: "Moderate", color: "text-warning" },
  { icon: Zap, label: "Active Outages", value: "3", color: "text-destructive" },
  { icon: Thermometer, label: "Grid Load", value: "72%", color: "text-info" },
  { icon: Shield, label: "PSPS Status", value: "Clear", color: "text-success" },
];

export default function StatusBar() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card"
        >
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
  );
}

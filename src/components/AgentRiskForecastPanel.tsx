import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Camera, Thermometer, Wind, Droplets, Activity } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Area, AreaChart } from "recharts";
import type { Customer } from "@/lib/customer-types";
import { getSubstationForZip } from "@/lib/wildfire-utils";

interface Props {
  customer: Customer;
}

function generate12hForecast(riskLevel: string, gridStress: string) {
  const base = riskLevel === "High" ? 0.65 : riskLevel === "Medium" ? 0.4 : 0.15;
  const stressMod = gridStress === "High" ? 0.12 : gridStress === "Medium" ? 0.06 : 0;
  const points: { hour: number; risk: number }[] = [];
  let val = base + stressMod;
  for (let h = 0; h <= 12; h++) {
    const jitter = (Math.sin(h * 1.3 + base * 10) * 0.08) + (Math.cos(h * 0.7) * 0.04);
    val = Math.max(0.02, Math.min(0.95, val + jitter));
    points.push({ hour: h, risk: Math.round(val * 100) / 100 });
  }
  return points;
}

function getTrend(data: { risk: number }[]): "RISING" | "STABLE" | "FALLING" {
  if (data.length < 3) return "STABLE";
  const first3 = data.slice(0, 3).reduce((s, d) => s + d.risk, 0) / 3;
  const last3 = data.slice(-3).reduce((s, d) => s + d.risk, 0) / 3;
  const diff = last3 - first3;
  if (diff > 0.05) return "RISING";
  if (diff < -0.05) return "FALLING";
  return "STABLE";
}

function getNearbyMonitors(zip: string) {
  const ss = getSubstationForZip(zip);
  return {
    cameras: [
      { id: "CAM-1", name: `${ss.name} North`, status: "online" as const, distKm: 1.2 },
      { id: "CAM-2", name: `${ss.zone} Ridge`, status: "online" as const, distKm: 3.8 },
    ],
    weatherStations: [
      { id: "WX-1", name: `${ss.zone} RAWS`, distKm: 2.1, windMph: 12 + Math.round(Math.random() * 15), humidity: 18 + Math.round(Math.random() * 30), tempF: 72 + Math.round(Math.random() * 20) },
      { id: "WX-2", name: `${ss.name} Meso`, distKm: 4.5, windMph: 8 + Math.round(Math.random() * 12), humidity: 22 + Math.round(Math.random() * 25), tempF: 68 + Math.round(Math.random() * 18) },
    ],
  };
}

const TREND_CFG = {
  RISING:  { icon: TrendingUp,   color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
  STABLE:  { icon: Minus,        color: "text-muted-foreground", bg: "bg-muted/60", border: "border-border" },
  FALLING: { icon: TrendingDown, color: "text-success",     bg: "bg-success/10",     border: "border-success/25" },
};

export default function AgentRiskForecastPanel({ customer }: Props) {
  const forecastData = useMemo(() => generate12hForecast(customer.wildfire_risk, customer.grid_stress_level), [customer.wildfire_risk, customer.grid_stress_level]);
  const trend = useMemo(() => getTrend(forecastData), [forecastData]);
  const { cameras, weatherStations } = useMemo(() => getNearbyMonitors(customer.zip_code), [customer.zip_code]);
  const tcfg = TREND_CFG[trend];
  const TrendIcon = tcfg.icon;
  const currentRisk = forecastData[forecastData.length - 1]?.risk ?? 0;
  const riskPct = Math.round(currentRisk * 100);
  const sparkColor = currentRisk > 0.6 ? "hsl(var(--destructive))" : currentRisk > 0.35 ? "hsl(var(--warning))" : "hsl(var(--success))";
  const gradientId = "risk-gradient";

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">12-Hour Risk Forecast</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${tcfg.color} ${tcfg.bg} border ${tcfg.border}`}>
          <TrendIcon className="w-3 h-3" />
          {trend}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Current risk + sparkline */}
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[60px]">
            <p className={`text-2xl font-bold ${currentRisk > 0.6 ? "text-destructive" : currentRisk > 0.35 ? "text-warning" : "text-success"}`}>
              {riskPct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Current</p>
          </div>
          <div className="flex-1 h-14">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <YAxis domain={[0, 1]} hide />
                <Area type="monotone" dataKey="risk" stroke={sparkColor} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-[64px]">
          <span>Now</span>
          <span>+6h</span>
          <span>+12h</span>
        </div>

        {/* Cameras */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cameras</p>
          <div className="grid grid-cols-2 gap-2">
            {cameras.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                <Camera className="w-3.5 h-3.5 text-info flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-card-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.distKm} km · <span className="text-success font-medium">{c.status}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Stations */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Weather Stations</p>
          <div className="space-y-2">
            {weatherStations.map((ws) => (
              <div key={ws.id} className="px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-card-foreground">{ws.name}</p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{ws.distKm} km</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Wind className="w-3 h-3" /> <span className="font-medium text-card-foreground">{ws.windMph}</span> mph
                  </span>
                  <span className={`flex items-center gap-1 ${ws.humidity < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                    <Droplets className="w-3 h-3" /> <span className={`font-medium ${ws.humidity < 20 ? "text-destructive" : "text-card-foreground"}`}>{ws.humidity}%</span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Thermometer className="w-3 h-3" /> <span className="font-medium text-card-foreground">{ws.tempF}°F</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

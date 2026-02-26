import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Camera, Thermometer, Wind, Droplets } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { Customer } from "@/lib/customer-types";
import { getSubstationForZip } from "@/lib/wildfire-utils";

interface Props {
  customer: Customer;
}

// Simulated 12h ignition-risk forecast based on customer risk profile
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

// Nearest cameras/weather stations relative to customer substation
function getNearbyMonitors(zip: string) {
  const ss = getSubstationForZip(zip);
  // Simulated cameras and weather stations near each substation
  const cameras = [
    { id: "CAM-1", name: `${ss.name} North Cam`, status: "online" as const, distKm: 1.2 },
    { id: "CAM-2", name: `${ss.zone} Ridge Cam`, status: "online" as const, distKm: 3.8 },
  ];
  const weatherStations = [
    {
      id: "WX-1", name: `${ss.zone} RAWS`,
      distKm: 2.1,
      windMph: 12 + Math.round(Math.random() * 15),
      humidity: 18 + Math.round(Math.random() * 30),
      tempF: 72 + Math.round(Math.random() * 20),
    },
    {
      id: "WX-2", name: `${ss.name} Mesonet`,
      distKm: 4.5,
      windMph: 8 + Math.round(Math.random() * 12),
      humidity: 22 + Math.round(Math.random() * 25),
      tempF: 68 + Math.round(Math.random() * 18),
    },
  ];
  return { cameras, weatherStations };
}

const TREND_CFG = {
  RISING: { icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  STABLE: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" },
  FALLING: { icon: TrendingDown, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
};

export default function AgentRiskForecastPanel({ customer }: Props) {
  const forecastData = useMemo(
    () => generate12hForecast(customer.wildfire_risk, customer.grid_stress_level),
    [customer.wildfire_risk, customer.grid_stress_level]
  );
  const trend = useMemo(() => getTrend(forecastData), [forecastData]);
  const { cameras, weatherStations } = useMemo(() => getNearbyMonitors(customer.zip_code), [customer.zip_code]);
  const tcfg = TREND_CFG[trend];
  const TrendIcon = tcfg.icon;
  const currentRisk = forecastData[forecastData.length - 1]?.risk ?? 0;
  const sparkColor = currentRisk > 0.6 ? "hsl(var(--destructive))" : currentRisk > 0.35 ? "hsl(var(--warning))" : "hsl(var(--success))";

  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">12-Hour Risk Forecast</h3>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${tcfg.color} ${tcfg.bg} border ${tcfg.border}`}>
          <TrendIcon className="w-3 h-3" />
          {trend}
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={forecastData}>
            <YAxis domain={[0, 1]} hide />
            <Line
              type="monotone"
              dataKey="risk"
              stroke={sparkColor}
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Now</span>
        <span>+6h</span>
        <span>+12h</span>
      </div>

      {/* Nearest Cameras */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nearest Cameras</h4>
        <div className="grid grid-cols-2 gap-2">
          {cameras.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
              <Camera className="w-3.5 h-3.5 text-info flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-card-foreground truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.distKm} km · <span className="text-success">{c.status}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nearest Weather Stations */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nearest Weather Stations</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {weatherStations.map((ws) => (
            <div key={ws.id} className="p-2.5 rounded-md border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-card-foreground truncate">{ws.name}</p>
                <span className="text-[10px] text-muted-foreground">{ws.distKm} km</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Wind className="w-3 h-3" /> {ws.windMph} mph
                </span>
                <span className={`flex items-center gap-1 ${ws.humidity < 20 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                  <Droplets className="w-3 h-3" /> {ws.humidity}%
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Thermometer className="w-3 h-3" /> {ws.tempF}°F
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

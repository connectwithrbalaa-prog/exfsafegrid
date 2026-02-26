import { useMemo } from "react";
import {
  TrendingUp, TrendingDown, Minus, Camera,
  Thermometer, Wind, Droplets, Activity, Gauge, Flame,
} from "lucide-react";
import { ResponsiveContainer, YAxis, Area, AreaChart, XAxis, Tooltip } from "recharts";
import type { Customer } from "@/lib/customer-types";
import { getSubstationForZip } from "@/lib/wildfire-utils";
import { useCircuitRiskTrend, useNearbySensors } from "@/hooks/use-backend-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

interface Props {
  customer: Customer;
}

const TREND_CFG = {
  RISING:  { icon: TrendingUp,   color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
  STABLE:  { icon: Minus,        color: "text-muted-foreground", bg: "bg-muted/60", border: "border-border" },
  FALLING: { icon: TrendingDown, color: "text-success",     bg: "bg-success/10",     border: "border-success/25" },
};

export default function AgentRiskForecastPanel({ customer }: Props) {
  const ss = getSubstationForZip(customer.zip_code);

  // Derive a circuit_id from the customer (convention: use region-based ID)
  const circuitId = useMemo(() => {
    // Try to build a plausible circuit_id from substation info
    return `CIRCUIT_${customer.zip_code}`;
  }, [customer.zip_code]);

  // Fetch real data
  const { data: trendData, isLoading: trendLoading, isError: trendError } = useCircuitRiskTrend(circuitId);
  const { data: sensorData, isLoading: sensorsLoading, isError: sensorsError } = useNearbySensors({
    lat: ss.latitude,
    lon: ss.longitude,
    radius_miles: 25,
    summary: true,
    circuit_id: circuitId,
  });

  // Chart data
  const chartData = useMemo(() => {
    if (!trendData?.hourly) return [];
    return trendData.hourly.map((h) => ({
      time: h.time,
      prob: h.prob,
      label: format(parseISO(h.time), "ha"),
    }));
  }, [trendData]);

  const trend = trendData?.trend_label ?? "STABLE";
  const tcfg = TREND_CFG[trend];
  const TrendIcon = tcfg.icon;

  const currentProb = chartData.length > 0 ? chartData[chartData.length - 1].prob : 0;
  const riskPct = Math.round(currentProb * 100);
  const sparkColor = currentProb > 0.6 ? "hsl(var(--destructive))" : currentProb > 0.35 ? "hsl(var(--warning))" : "hsl(var(--success))";
  const gradientId = `risk-gradient-${circuitId}`;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">12-Hour Risk Forecast</h3>
        </div>
        {trendLoading ? (
          <Skeleton className="h-6 w-20 rounded-lg" />
        ) : trendError ? (
          <span className="text-[10px] text-muted-foreground px-2.5 py-1 rounded-lg bg-muted">No predictions yet</span>
        ) : (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${tcfg.color} ${tcfg.bg} border ${tcfg.border}`}>
            <TrendIcon className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Current risk + sparkline */}
        {trendLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-[60px] h-12 rounded" />
            <Skeleton className="flex-1 h-14 rounded" />
          </div>
        ) : trendError || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-14 text-xs text-muted-foreground">
            No prediction data available for this circuit
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="text-center min-w-[60px]">
                <p className={`text-2xl font-bold ${currentProb > 0.6 ? "text-destructive" : currentProb > 0.35 ? "text-warning" : "text-success"}`}>
                  {riskPct}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Current</p>
              </div>
              <div className="flex-1 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={[0, 1]} hide />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="px-2.5 py-1.5 bg-popover border border-border rounded-lg shadow-lg text-xs">
                            <p className="text-muted-foreground">{d.label}</p>
                            <p className="font-bold text-card-foreground">{Math.round(d.prob * 100)}%</p>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="prob" stroke={sparkColor} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} animationDuration={600} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-[64px]">
              <span>{chartData[0]?.label}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </div>
          </>
        )}

        {/* AI Summary */}
        {sensorData?.summary && (
          <div className="px-3.5 py-2.5 rounded-lg border border-primary/20 bg-primary/5">
            <p className="text-xs text-card-foreground leading-relaxed">
              <span className="font-semibold text-primary">AI Summary: </span>
              {sensorData.summary}
            </p>
          </div>
        )}

        {/* RAWS Weather Stations */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nearby RAWS Stations</p>
          {sensorsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : sensorsError || !sensorData?.raws_stations?.length ? (
            <p className="text-xs text-muted-foreground py-2">No sensor data available</p>
          ) : (
            <div className="space-y-2">
              {sensorData.raws_stations.map((ws) => (
                <div key={ws.station_id} className="px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-card-foreground">{ws.station_name}</p>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {ws.distance_miles.toFixed(1)} mi
                    </span>
                  </div>
                  {/* Primary weather metrics */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Wind className="w-3 h-3" />
                      <span className="font-medium text-card-foreground">{ws.wind_speed_mph}</span> mph
                      {ws.wind_gust_mph > ws.wind_speed_mph && (
                        <span className="text-warning font-medium">(G{ws.wind_gust_mph})</span>
                      )}
                    </span>
                    <span className={`flex items-center gap-1 ${ws.rh_pct < 15 ? "text-destructive" : ws.rh_pct < 25 ? "text-warning" : "text-muted-foreground"}`}>
                      <Droplets className="w-3 h-3" />
                      <span className={`font-medium ${ws.rh_pct < 15 ? "text-destructive" : ws.rh_pct < 25 ? "text-warning" : "text-card-foreground"}`}>{ws.rh_pct}%</span> RH
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Thermometer className="w-3 h-3" />
                      <span className="font-medium text-card-foreground">{ws.temp_f}°F</span>
                    </span>
                  </div>
                  {/* Fire weather indices */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-2.5 h-2.5" />
                      ERC <span className={`font-semibold ${ws.erc > 60 ? "text-destructive" : "text-card-foreground"}`}>{ws.erc}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5" />
                      BI <span className={`font-semibold ${ws.bi > 80 ? "text-destructive" : "text-card-foreground"}`}>{ws.bi}</span>
                    </span>
                    <span>
                      FFWI <span className={`font-semibold ${ws.ffwi > 40 ? "text-warning" : "text-card-foreground"}`}>{ws.ffwi}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cameras (placeholder for future data) */}
        {sensorData?.cameras && sensorData.cameras.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cameras</p>
            <div className="grid grid-cols-2 gap-2">
              {sensorData.cameras.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
                  <Camera className="w-3.5 h-3.5 text-info flex-shrink-0" />
                  <p className="text-xs font-medium text-card-foreground truncate">{c.name || c.station_name || `Camera ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCircuitRiskTrend } from "@/hooks/use-backend-data";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";

interface Props {
  circuitId: string;
  onClose: () => void;
}

const TREND_CFG = {
  RISING:  { icon: TrendingUp,   label: "Rising",  color: "#f87171", bg: "bg-red-500/15" },
  STABLE:  { icon: Minus,        label: "Stable",   color: "#9ca3af", bg: "bg-white/5" },
  FALLING: { icon: TrendingDown, label: "Falling",  color: "#34d399", bg: "bg-emerald-500/15" },
};

export default function CircuitRiskTrendRow({ circuitId, onClose }: Props) {
  const { data, isLoading, isError } = useCircuitRiskTrend(circuitId);

  const chartData = useMemo(() => {
    if (!data?.hourly) return [];
    return data.hourly.map((h) => ({
      time: h.time,
      prob: h.prob,
      label: format(parseISO(h.time), "ha"),
    }));
  }, [data]);

  const trend = data?.trend_label ?? "STABLE";
  const tcfg = TREND_CFG[trend];
  const TrendIcon = tcfg.icon;
  const currentProb = chartData.length > 0 ? chartData[chartData.length - 1].prob : 0;

  const sparkColor = currentProb > 0.6 ? "#f87171" : currentProb > 0.35 ? "#fbbf24" : "#34d399";

  return (
    <tr>
      <td colSpan={12} className="px-4 py-0">
        <div className="py-3 px-2 rounded-lg bg-white/[0.02] border border-white/[0.06] my-1">
          {isLoading ? (
            <div className="flex items-center gap-4 h-12">
              <Skeleton className="h-8 w-20 rounded bg-white/10" />
              <Skeleton className="h-8 flex-1 rounded bg-white/10" />
            </div>
          ) : isError || chartData.length === 0 ? (
            <div className="flex items-center justify-between h-10 px-2">
              <span className="text-xs text-white/40">No predictions yet for {circuitId}</span>
              <button onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60 underline">Close</button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Current prob + trend badge */}
              <div className="flex flex-col items-center min-w-[70px] gap-1">
                <span className="text-lg font-bold" style={{ color: sparkColor }}>
                  {Math.round(currentProb * 100)}%
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${tcfg.bg}`} style={{ color: tcfg.color }}>
                  <TrendIcon className="w-3 h-3" />
                  {tcfg.label}
                </span>
              </div>

              {/* Sparkline */}
              <div className="flex-1 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`crt-${circuitId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sparkColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={[0, 1]} hide />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="px-2 py-1 bg-[hsl(220,25%,12%)] border border-white/10 rounded text-[11px] shadow-lg">
                            <p className="text-white/50">{d.label}</p>
                            <p className="font-bold text-white">{Math.round(d.prob * 100)}%</p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="prob"
                      stroke={sparkColor}
                      strokeWidth={2}
                      fill={`url(#crt-${circuitId})`}
                      dot={false}
                      animationDuration={500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Time labels */}
              <div className="hidden sm:flex flex-col text-[9px] text-white/30 min-w-[50px]">
                <span>{chartData[0]?.label}</span>
                <span className="mt-auto">{chartData[chartData.length - 1]?.label}</span>
              </div>

              <button onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-2">✕</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

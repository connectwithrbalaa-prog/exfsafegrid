import { useDailyRiskTrend } from "@/hooks/use-backend-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useState, useMemo } from "react";
import type { DailyTrendLabel, RiskBucket } from "@/lib/backend-api";

interface Props {
  circuitId: string;
  onClose: () => void;
}

/* ── colour helpers ─────────────────────────────────────────── */
const BUCKET_COLOR: Record<RiskBucket, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MODERATE: "#f59e0b",
  LOW: "#22c55e",
};

const TREND_CFG: Record<
  DailyTrendLabel,
  { symbol: string; label: string; color: string; pulse?: boolean }
> = {
  APPROACHING: { symbol: "⚠", label: "APPROACHING", color: "#f97316", pulse: true },
  RISING:      { symbol: "↑", label: "RISING",      color: "#f97316" },
  FALLING:     { symbol: "↓", label: "FALLING",     color: "#22c55e" },
  PEAKED:      { symbol: "⬆", label: "PEAKED",      color: "#eab308" },
  STABLE:      { symbol: "—", label: "STABLE",       color: "#9ca3af" },
  VOLATILE:    { symbol: "~", label: "VOLATILE",     color: "#a855f7" },
};

export default function CircuitRiskTrendRow({ circuitId, onClose }: Props) {
  const [days, setDays] = useState<3 | 7>(3);
  const { data, isLoading, isError } = useDailyRiskTrend(circuitId, days);

  const chartData = useMemo(() => {
    if (!data?.probabilities) return [];
    return data.probabilities.map((pt) => ({
      date: pt.date,
      p: pt.p,
      bucket: pt.risk_bucket,
    }));
  }, [data]);

  const latestBucket: RiskBucket =
    chartData.length > 0 ? chartData[chartData.length - 1].bucket : "LOW";
  const lineColor = BUCKET_COLOR[latestBucket];
  const trend = data?.trend_label ?? "STABLE";
  const tcfg = TREND_CFG[trend];

  return (
    <tr>
      <td colSpan={12} className="px-4 py-0">
        <div className="py-3 px-2 rounded-lg bg-card/50 border border-border/40 my-1 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-4 h-14">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-10 flex-1 rounded" />
            </div>
          ) : isError || chartData.length === 0 ? (
            <div className="flex items-center justify-between h-10 px-2">
              <span className="text-xs text-muted-foreground">No data for {circuitId}</span>
              <button onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground underline">Close</button>
            </div>
          ) : (
            <>
              {/* Header row: trend badge + days toggle + close */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-[11px] font-bold border-0 ${tcfg.pulse ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: `${tcfg.color}22`, color: tcfg.color }}
                  >
                    {tcfg.symbol} {tcfg.label}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(chartData[chartData.length - 1].p * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* 3d / 7d toggle */}
                  <div className="flex rounded-md overflow-hidden border border-border text-[10px]">
                    {([3, 7] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`px-2 py-0.5 transition-colors ${
                          days === d
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Sparkline chart */}
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`drt-${circuitId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)} /* MM-DD */
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 1]} hide />
                    <ReferenceLine
                      y={0.5}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      label={{ value: "HIGH", position: "right", fontSize: 8, fill: "#f59e0b" }}
                    />
                    <ReferenceLine
                      y={0.75}
                      stroke="#ef4444"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      label={{ value: "CRIT", position: "right", fontSize: 8, fill: "#ef4444" }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="px-2 py-1 bg-popover border border-border rounded text-[11px] shadow-lg">
                            <p className="text-muted-foreground">{d.date}</p>
                            <p className="font-bold text-foreground">{Math.round(d.p * 100)}%</p>
                            <p className="text-[10px]" style={{ color: BUCKET_COLOR[d.bucket as RiskBucket] }}>
                              {d.bucket}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="p"
                      stroke={lineColor}
                      strokeWidth={2}
                      fill={`url(#drt-${circuitId})`}
                      dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                      animationDuration={400}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* AI summary callout */}
              {data?.summary && (
                <p className="text-[11px] italic text-muted-foreground px-1 leading-snug">
                  {data.summary}
                </p>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

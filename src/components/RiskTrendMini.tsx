import { useDailyRiskTrend } from "@/hooks/use-backend-data";
import type { DailyTrendLabel } from "@/lib/backend-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

const TREND_CFG: Record<DailyTrendLabel, { symbol: string; label: string; color: string; pulse?: boolean }> = {
  APPROACHING: { symbol: "⚠", label: "APPROACHING", color: "#f97316", pulse: true },
  RISING:      { symbol: "↑", label: "RISING",      color: "#f97316" },
  FALLING:     { symbol: "↓", label: "FALLING",     color: "#22c55e" },
  PEAKED:      { symbol: "⬆", label: "PEAKED",      color: "#eab308" },
  STABLE:      { symbol: "—", label: "STABLE",       color: "#9ca3af" },
  VOLATILE:    { symbol: "~", label: "VOLATILE",     color: "#a855f7" },
};

const BUCKET_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#f59e0b", LOW: "#22c55e",
};

interface Props {
  circuitId: string;
  label?: string;
}

export default function RiskTrendMini({ circuitId, label }: Props) {
  const [days, setDays] = useState<3 | 7>(3);
  const { data, isLoading } = useDailyRiskTrend(circuitId, days);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
        <Skeleton className="h-8 w-16 rounded bg-white/5" />
        <Skeleton className="h-8 flex-1 rounded bg-white/5" />
      </div>
    );
  }

  if (!data?.probabilities?.length) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
        <TrendingUp className="w-3.5 h-3.5 text-white/20" />
        <span className="text-[11px] text-white/30">No trend data for {label || circuitId}</span>
      </div>
    );
  }

  const tcfg = TREND_CFG[data.trend_label] ?? TREND_CFG.STABLE;
  const lastPt = data.probabilities[data.probabilities.length - 1];
  const lineColor = BUCKET_COLOR[lastPt.risk_bucket] ?? "#9ca3af";

  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[11px] font-medium text-white/60">Risk Trend</span>
          <div className="flex rounded-md overflow-hidden border border-white/[0.08] text-[9px] ml-1">
            {([3, 7] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-1.5 py-px transition-colors ${
                  days === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.03] text-white/30 hover:text-white/50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-bold ${tcfg.pulse ? "animate-pulse" : ""}`}
            style={{ backgroundColor: `${tcfg.color}22`, color: tcfg.color }}
          >
            {tcfg.symbol} {tcfg.label}
          </span>
          <span className="text-sm font-bold" style={{ color: lineColor }}>
            {Math.round(lastPt.p * 100)}%
          </span>
        </div>
      </div>

      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.probabilities.map((pt) => ({ p: pt.p }))}>
            <YAxis domain={[0, 1]} hide />
            <Area
              type="monotone"
              dataKey="p"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`${lineColor}15`}
              dot={{ r: 2, fill: lineColor, strokeWidth: 0 }}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.summary && (
        <p className="text-[10px] italic text-white/35 leading-snug">{data.summary}</p>
      )}
    </div>
  );
}

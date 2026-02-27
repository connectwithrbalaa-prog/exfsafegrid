import { useDailyRiskTrend } from "@/hooks/use-backend-data";
import type { DailyRiskTrendResponse, DailyTrendLabel } from "@/lib/backend-api";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { useMemo } from "react";

const MOCK_CIRCUITS = ["CKT-2201", "CKT-2205", "CKT-1103", "CKT-3301", "CKT-1407"];

const TREND_CFG: Record<DailyTrendLabel, { symbol: string; color: string; pulse?: boolean }> = {
  APPROACHING: { symbol: "⚠", color: "#f97316", pulse: true },
  RISING:      { symbol: "↑", color: "#f97316" },
  FALLING:     { symbol: "↓", color: "#22c55e" },
  PEAKED:      { symbol: "⬆", color: "#eab308" },
  STABLE:      { symbol: "—", color: "#9ca3af" },
  VOLATILE:    { symbol: "~", color: "#a855f7" },
};

const BUCKET_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#f59e0b", LOW: "#22c55e",
};

function useCircuitTrend(cid: string) {
  return useDailyRiskTrend(cid, 3);
}

export default function Top5RisingRiskCard() {
  // Fixed-size hook calls (never changes length)
  const q0 = useCircuitTrend(MOCK_CIRCUITS[0]);
  const q1 = useCircuitTrend(MOCK_CIRCUITS[1]);
  const q2 = useCircuitTrend(MOCK_CIRCUITS[2]);
  const q3 = useCircuitTrend(MOCK_CIRCUITS[3]);
  const q4 = useCircuitTrend(MOCK_CIRCUITS[4]);

  const queries = [q0, q1, q2, q3, q4];
  const isLoading = queries.some((q) => q.isLoading);

  const results = useMemo(() =>
    queries
      .filter((q) => q.data)
      .map((q) => q.data as DailyRiskTrendResponse)
      .filter((d) => ["APPROACHING", "RISING", "PEAKED", "VOLATILE"].includes(d.trend_label))
      .sort((a, b) => {
        const aP = a.probabilities[a.probabilities.length - 1]?.p ?? 0;
        const bP = b.probabilities[b.probabilities.length - 1]?.p ?? 0;
        return bP - aP;
      })
      .slice(0, 5),
    [q0.data, q1.data, q2.data, q3.data, q4.data]
  );

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-semibold">Top Circuits by Rising Risk</h2>
        <span className="text-[10px] text-white/30 ml-auto">3-day trend</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded bg-white/5" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-xs text-white/30 py-4 text-center">No rising risk circuits detected</p>
      ) : (
        <div className="space-y-2">
          {results.map((d) => {
            const lastPt = d.probabilities[d.probabilities.length - 1];
            const tcfg = TREND_CFG[d.trend_label] ?? TREND_CFG.STABLE;
            const lineColor = BUCKET_COLOR[lastPt?.risk_bucket] ?? "#9ca3af";

            return (
              <div
                key={d.circuit_id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                {/* Circuit + badge */}
                <div className="min-w-[100px]">
                  <span className="text-xs font-mono font-semibold text-white/80">{d.circuit_id}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-bold ${tcfg.pulse ? "animate-pulse" : ""}`}
                      style={{ backgroundColor: `${tcfg.color}22`, color: tcfg.color }}
                    >
                      {tcfg.symbol} {d.trend_label}
                    </span>
                  </div>
                </div>

                {/* Mini sparkline */}
                <div className="flex-1 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.probabilities.map((pt) => ({ p: pt.p }))}>
                      <YAxis domain={[0, 1]} hide />
                      <Area
                        type="monotone"
                        dataKey="p"
                        stroke={lineColor}
                        strokeWidth={1.5}
                        fill={`${lineColor}15`}
                        dot={false}
                        animationDuration={300}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Probability */}
                <div className="text-right min-w-[50px]">
                  <span className="text-sm font-bold" style={{ color: lineColor }}>
                    {Math.round((lastPt?.p ?? 0) * 100)}%
                  </span>
                  <p className="text-[9px] text-white/30">{lastPt?.risk_bucket}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

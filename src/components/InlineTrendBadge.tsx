import { useDailyRiskTrend } from "@/hooks/use-backend-data";
import type { DailyTrendLabel } from "@/lib/backend-api";

const CFG: Record<DailyTrendLabel, { symbol: string; label: string; color: string; pulse?: boolean }> = {
  APPROACHING: { symbol: "⚠", label: "APPROACHING", color: "#f97316", pulse: true },
  RISING:      { symbol: "↑", label: "RISING",      color: "#f97316" },
  FALLING:     { symbol: "↓", label: "FALLING",     color: "#22c55e" },
  PEAKED:      { symbol: "⬆", label: "PEAKED",      color: "#eab308" },
  STABLE:      { symbol: "—", label: "STABLE",       color: "#9ca3af" },
  VOLATILE:    { symbol: "~", label: "VOLATILE",     color: "#a855f7" },
};

export default function InlineTrendBadge({ circuitId }: { circuitId: string }) {
  const { data, isLoading } = useDailyRiskTrend(circuitId, 3);

  if (isLoading) return <span className="inline-block w-10 h-3 rounded bg-muted animate-pulse" />;
  if (!data?.trend_label) return null;

  const t = CFG[data.trend_label] ?? CFG.STABLE;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-bold leading-none whitespace-nowrap ${t.pulse ? "animate-pulse" : ""}`}
      style={{ backgroundColor: `${t.color}22`, color: t.color }}
    >
      {t.symbol} {t.label}
    </span>
  );
}

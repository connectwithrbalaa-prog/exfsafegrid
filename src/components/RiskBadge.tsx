import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  CRITICAL: "bg-red-600/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-600/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-600/20 text-green-400 border-green-500/30",
};

interface RiskBadgeProps {
  level: string;
  className?: string;
}

export default function RiskBadge({ level, className }: RiskBadgeProps) {
  const key = (level ?? "").toUpperCase();
  const color = COLORS[key] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        color,
        className,
      )}
    >
      {level ?? "—"}
    </span>
  );
}

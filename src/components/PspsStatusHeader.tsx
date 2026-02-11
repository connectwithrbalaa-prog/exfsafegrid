import { useState, useEffect } from "react";
import { Activity, Clock, ExternalLink, FileText, Settings2 } from "lucide-react";

interface PspsStats {
  circuits: number;
  customersAffected: number;
  crcsOpen: number;
  weatherAllClearMin: number;
  patrollingDone: number;
  patrollingTotal: number;
}

function usePspsStats(): PspsStats {
  const [stats, setStats] = useState<PspsStats>({
    circuits: 47,
    customersAffected: 18472,
    crcsOpen: 12,
    weatherAllClearMin: 872,
    patrollingDone: 937,
    patrollingTotal: 1512,
  });

  // Live countdown tick
  useEffect(() => {
    const timer = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        weatherAllClearMin: Math.max(0, prev.weatherAllClearMin - 1),
        patrollingDone: Math.min(prev.patrollingTotal, prev.patrollingDone + (Math.random() > 0.7 ? 1 : 0)),
      }));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Listen for progress updates from SafetyModules
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.affectedDelta) {
        setStats((prev) => ({
          ...prev,
          customersAffected: Math.max(0, prev.customersAffected + detail.affectedDelta),
        }));
      }
    };
    window.addEventListener("psps-progress-updated", handler);
    return () => window.removeEventListener("psps-progress-updated", handler);
  }, []);

  return stats;
}

function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 60);
  const m = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function PspsStatusHeader() {
  const stats = usePspsStats();
  const patrolPct = Math.round((stats.patrollingDone / stats.patrollingTotal) * 100);
  const [flash, setFlash] = useState(false);

  // Flash animation on affected count change
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [stats.customersAffected]);

  return (
    <div className="sticky top-0 z-50 border-b border-destructive/30 bg-destructive/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-1">
        {/* Row 1 — headline stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
            </span>
            <span className="text-xs font-bold text-destructive uppercase tracking-wide">Live PSPS Status</span>
          </span>

          <span className="h-3 w-px bg-border" />
          <Stat label="Circuits" value={stats.circuits.toLocaleString()} />
          <span className="h-3 w-px bg-border" />
          <Stat
            label="Customers Affected"
            value={stats.customersAffected.toLocaleString()}
            flash={flash}
          />
          <span className="h-3 w-px bg-border" />
          <Stat label="CRCs Open" value={String(stats.crcsOpen)} />
        </div>

        {/* Row 2 — timers + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Weather All-Clear:</span>
            <span className="font-mono font-bold text-foreground tabular-nums">{formatCountdown(stats.weatherAllClearMin)}</span>
          </div>

          <span className="h-3 w-px bg-border" />

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="w-3 h-3" />
            <span>Patrolling:</span>
            <span className="font-mono font-bold text-foreground tabular-nums">{patrolPct}%</span>
            <span className="text-[10px]">({stats.patrollingDone.toLocaleString()}/{stats.patrollingTotal.toLocaleString()} circuits)</span>
          </div>

          {/* Progress micro-bar */}
          <div className="hidden sm:block w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${patrolPct}%` }}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <HeaderAction icon={ExternalLink} label="PSPS Dashboard" />
            <HeaderAction icon={FileText} label="Event Log" />
            <HeaderAction icon={Settings2} label="Resources" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, flash }: { label: string; value: string; flash?: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs transition-all duration-300 ${flash ? "scale-110 text-destructive" : ""}`}>
      <span className="font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function HeaderAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={() => {}}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

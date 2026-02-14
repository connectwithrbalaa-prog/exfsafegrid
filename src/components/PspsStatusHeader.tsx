import { useState, useEffect } from "react";
import { Activity, Clock, ExternalLink, FileText, Settings2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-destructive/30 bg-background shadow-md">
        <div className="absolute inset-0 bg-destructive/5" />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-1.5 md:py-2 space-y-0.5 md:space-y-1">
          {/* Row 1 — headline stats */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <span className="flex items-center gap-1 md:gap-1.5">
              <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-destructive" />
              </span>
              <span className="text-[10px] md:text-xs font-bold text-destructive uppercase tracking-wide">Live PSPS Status</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help hidden sm:block" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">Real-time Public Safety Power Shutoff (PSPS) event tracking. Shows active power shutoff circuits, affected customers, and restoration progress.</p>
                </TooltipContent>
              </Tooltip>
            </span>

            <span className="h-3 w-px bg-border" />
            <Stat label="Circuits" value={stats.circuits.toLocaleString()} />
            <span className="h-3 w-px bg-border" />
            <Stat
              label="Affected"
              value={stats.customersAffected.toLocaleString()}
              flash={flash}
            />
            <span className="h-3 w-px bg-border hidden sm:block" />
            <Stat label="CRCs" value={String(stats.crcsOpen)} className="hidden sm:flex" />
          </div>

          {/* Row 2 — timers + actions */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="hidden sm:inline">Weather All-Clear:</span>
              <span className="sm:hidden">All-Clear:</span>
              <span className="font-mono font-bold text-foreground tabular-nums">{formatCountdown(stats.weatherAllClearMin)}</span>
            </div>

            <span className="h-3 w-px bg-border" />

            <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span className="hidden md:inline">Patrolling:</span>
              <span className="font-mono font-bold text-foreground tabular-nums">{patrolPct}%</span>
              <span className="text-[9px] md:text-[10px] hidden sm:inline">({stats.patrollingDone.toLocaleString()}/{stats.patrollingTotal.toLocaleString()})</span>
            </div>

            {/* Progress micro-bar */}
            <div className="hidden sm:block w-16 md:w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${patrolPct}%` }}
              />
            </div>

            <div className="ml-auto flex items-center gap-1 md:gap-2">
              <HeaderAction icon={ExternalLink} label="PSPS Dashboard" hideLabel />
              <HeaderAction icon={FileText} label="Event Log" hideLabel />
              <HeaderAction icon={Settings2} label="Resources" hideLabel />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Stat({ label, value, flash, className }: { label: string; value: string; flash?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-1 text-[10px] md:text-xs transition-all duration-300 ${flash ? "scale-110 text-destructive" : ""} ${className ?? ""}`}>
      <span className="font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function HeaderAction({ icon: Icon, label, hideLabel }: { icon: React.ElementType; label: string; hideLabel?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {}}
          className="flex items-center gap-1 text-[10px] font-medium px-1.5 md:px-2 py-1 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon className="w-3 h-3" />
          {hideLabel ? <span className="hidden lg:inline">{label}</span> : label}
        </button>
      </TooltipTrigger>
      {hideLabel && (
        <TooltipContent side="bottom" className="lg:hidden">
          <p className="text-xs">{label}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

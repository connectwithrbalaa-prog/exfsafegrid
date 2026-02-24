import { useState, useMemo, useEffect, useRef } from "react";
import { AlertTriangle, Bell, BellOff, Settings2, Flame, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CircuitRisk {
  circuitId: string;
  name: string;
  prob: number;
  band: string;
}

interface RiskAlert {
  id: string;
  circuitId: string;
  name: string;
  prob: number;
  band: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface RiskAlertsPanelProps {
  circuitRiskMap: Map<string, { prob: number; band: string }>;
  assetNames: Map<string, string>;
}

const BAND_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  High: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  Elevated: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  Low: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
};

export default function RiskAlertsPanel({ circuitRiskMap, assetNames }: RiskAlertsPanelProps) {
  const [threshold, setThreshold] = useState([50]);
  const [enabled, setEnabled] = useState(true);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const prevBreachesRef = useRef<Set<string>>(new Set());

  const thresholdPct = threshold[0] / 100;

  // Detect new threshold breaches
  useEffect(() => {
    if (!enabled || circuitRiskMap.size === 0) return;

    const currentBreaches = new Set<string>();
    const newAlerts: RiskAlert[] = [];

    circuitRiskMap.forEach(({ prob, band }, circuitId) => {
      if (prob >= thresholdPct) {
        currentBreaches.add(circuitId);
        if (!prevBreachesRef.current.has(circuitId)) {
          newAlerts.push({
            id: `${circuitId}-${Date.now()}`,
            circuitId,
            name: assetNames.get(circuitId) || circuitId,
            prob,
            band,
            timestamp: new Date(),
            acknowledged: false,
          });
        }
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 200));
    }
    prevBreachesRef.current = currentBreaches;
  }, [circuitRiskMap, thresholdPct, enabled, assetNames]);

  // Current breaches
  const activeBreaches = useMemo(() => {
    const breaches: CircuitRisk[] = [];
    circuitRiskMap.forEach(({ prob, band }, circuitId) => {
      if (prob >= thresholdPct) {
        breaches.push({ circuitId, name: assetNames.get(circuitId) || circuitId, prob, band });
      }
    });
    return breaches.sort((a, b) => b.prob - a.prob);
  }, [circuitRiskMap, thresholdPct, assetNames]);

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const acknowledgeAll = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  };

  const acknowledgeOne = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  };

  const clearAll = () => setAlerts([]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Circuit Risk Alerts</h3>
            <p className="text-[11px] text-white/40">
              {enabled ? `Monitoring ${circuitRiskMap.size} circuits · Threshold: ${threshold[0]}%` : "Monitoring paused"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 && (
            <button
              onClick={acknowledgeAll}
              className="text-[10px] px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white/50 hover:text-white/80 transition-colors"
            >
              Ack all ({unacknowledgedCount})
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md border transition-colors ${
              showSettings ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {enabled ? <Bell className="w-4 h-4 text-orange-400" /> : <BellOff className="w-4 h-4 text-white/30" />}
              <span className="text-xs font-medium text-white/70">Enable alerts</span>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Ignition probability threshold</span>
              <span className="text-xs font-mono font-semibold text-orange-400">{threshold[0]}%</span>
            </div>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              min={10}
              max={90}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-white/30">
              <span>10% (Sensitive)</span>
              <span>90% (Critical only)</span>
            </div>
          </div>
          <button
            onClick={clearAll}
            className="text-[10px] px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Clear alert history
          </button>
        </div>
      )}

      {/* Active breaches summary */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-semibold text-white/80">
            Active Breaches ({activeBreaches.length})
          </span>
        </div>
        {activeBreaches.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-4">
            No circuits exceed the {threshold[0]}% threshold
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {activeBreaches.map((b) => {
              const style = BAND_STYLES[b.band] || BAND_STYLES.Low;
              return (
                <div key={b.circuitId} className={`flex items-center justify-between px-3 py-2 rounded-md border ${style.bg} ${style.border}`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-3.5 h-3.5 ${style.text}`} />
                    <span className="text-xs font-medium text-white/90">{b.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-semibold ${style.text}`}>{(b.prob * 100).toFixed(1)}%</span>
                    <Badge variant="outline" className={`text-[9px] ${style.text} ${style.border}`}>{b.band}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert history log */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-white/50" />
          <span className="text-xs font-semibold text-white/80">Alert History</span>
          <span className="text-[10px] text-white/30 ml-auto">{alerts.length} events</span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-4">No alerts recorded yet</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {alerts.map((a) => {
              const style = BAND_STYLES[a.band] || BAND_STYLES.Low;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                    a.acknowledged
                      ? "bg-white/[0.01] border-white/[0.05] opacity-50"
                      : `${style.bg} ${style.border}`
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${a.acknowledged ? "text-white/20" : style.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/80 truncate">{a.name}</span>
                      <span className={`text-[10px] font-mono ${a.acknowledged ? "text-white/30" : style.text}`}>
                        {(a.prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-white/30">
                      {a.timestamp.toLocaleTimeString()} · {a.timestamp.toLocaleDateString()}
                    </span>
                  </div>
                  {!a.acknowledged && (
                    <button
                      onClick={() => acknowledgeOne(a.id)}
                      className="text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.05] text-white/40 hover:text-white/70 transition-colors shrink-0"
                    >
                      Ack
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

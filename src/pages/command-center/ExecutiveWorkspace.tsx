/**
 * ExecutiveWorkspace — High-level KPIs, top risks, PSPS simulator link.
 */
import { useNavigate } from "react-router-dom";
import { Activity, Zap, AlertTriangle, TrendingUp, Shield, BookOpen, History } from "lucide-react";
import { useCircuitIgnitionRisk, usePsaRisk } from "@/hooks/use-backend-data";
import Top5RisingRiskCard from "@/components/Top5RisingRiskCard";
import BackendOpsPanel from "@/components/BackendOpsPanel";
import DemoBadge from "@/components/DemoBadge";
import { useMemo } from "react";

export default function ExecutiveWorkspace() {
  const navigate = useNavigate();
  const circuitRiskQuery = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 500 });
  const psaRiskQuery = usePsaRisk({ limit: 500 });

  const circuitResults = circuitRiskQuery.data?.results ?? circuitRiskQuery.data?.predictions ?? [];
  const psaResults = psaRiskQuery.data?.results ?? psaRiskQuery.data?.predictions ?? [];
  const isDemo = circuitRiskQuery.data?.demo || psaRiskQuery.data?.demo;

  const criticalCircuits = useMemo(
    () => circuitResults.filter((r: any) => r.risk_band === "CRITICAL" || r.risk_band === "HIGH").length,
    [circuitResults]
  );

  const criticalPsas = useMemo(
    () => psaResults.filter((r: any) => r.risk_bucket === "CRITICAL" || r.risk_bucket === "HIGH" || r.risk_band === "CRITICAL" || r.risk_band === "HIGH").length,
    [psaResults]
  );

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Zap className="w-5 h-5 text-blue-400" />}
          label="Circuits Monitored"
          value={String(circuitResults.length)}
          loading={circuitRiskQuery.isLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          label="High / Critical Circuits"
          value={String(criticalCircuits)}
          loading={circuitRiskQuery.isLoading}
          highlight={criticalCircuits > 0}
        />
        <KpiCard
          icon={<Activity className="w-5 h-5 text-orange-400" />}
          label="PSAs Elevated"
          value={String(criticalPsas)}
          loading={psaRiskQuery.isLoading}
          highlight={criticalPsas > 0}
        />
        <div
          onClick={() => navigate("/psps-simulator")}
          className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-4 flex flex-col justify-between cursor-pointer hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-violet-400" />
            <span className="text-[11px] font-medium text-white/60">PSPS Simulator</span>
          </div>
          <span className="text-sm font-bold text-violet-300 group-hover:text-violet-200 transition-colors">
            Open Simulator →
          </span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => navigate("/playbooks")}
          className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors group"
        >
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-sm font-semibold group-hover:text-emerald-300 transition-colors">Playbooks</div>
            <div className="text-[11px] text-white/40">Saved PSPS configurations</div>
          </div>
        </div>
        <div
          onClick={() => navigate("/replay")}
          className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors group"
        >
          <History className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-sm font-semibold group-hover:text-amber-300 transition-colors">Historical Replay</div>
            <div className="text-[11px] text-white/40">Re-run past PSPS events</div>
          </div>
        </div>
      </div>

      {isDemo && (
        <div className="flex items-center gap-2">
          <DemoBadge label="Backend returned synthetic fallback data" />
        </div>
      )}

      {/* Top 5 Rising Risk */}
      <Top5RisingRiskCard />

      {/* Quick PSA Risk Summary */}
      {psaResults.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold">PSA Activity Risk (Top 10)</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {psaResults.slice(0, 10).map((r: any, i: number) => {
              const prob = r.prob_above_normal ?? r.probability ?? 0;
              const bucket = r.risk_bucket ?? r.risk_band ?? "LOW";
              const id = r.circuit_id ?? r.psa_id ?? `PSA-${i}`;
              return (
                <div key={i} className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <div className="text-[10px] text-white/30 font-mono">{id}</div>
                  <div className="text-lg font-bold tabular-nums">{(prob * 100).toFixed(0)}%</div>
                  <span className={`text-[10px] font-semibold ${
                    bucket === "CRITICAL" ? "text-red-400" :
                    bucket === "HIGH" ? "text-orange-400" :
                    bucket === "ELEVATED" || bucket === "MODERATE" ? "text-amber-400" :
                    "text-emerald-400"
                  }`}>{bucket}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backend Ops (compact) */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
        <BackendOpsPanel />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, loading, highlight }: {
  icon: React.ReactNode; label: string; value: string; loading: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col justify-between bg-[hsl(220,25%,9%)] ${
      highlight ? "border-red-500/30 bg-red-500/5" : "border-white/[0.08]"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-medium text-white/60">{label}</span>
      </div>
      <span className={`text-3xl font-bold tabular-nums ${highlight ? "text-red-400" : "text-white/90"}`}>
        {loading ? "…" : value}
      </span>
    </div>
  );
}

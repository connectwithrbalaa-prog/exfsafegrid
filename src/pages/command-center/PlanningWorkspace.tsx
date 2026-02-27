/**
 * PlanningWorkspace — Asset risk list, vegetation, insurance, threshold sliders.
 */
import { useState } from "react";
import { BarChart3, Layers, DollarSign, Settings, Shield, Bell } from "lucide-react";
import VegetationRiskPanel from "@/components/VegetationRiskPanel";
import InsuranceRiskPanel from "@/components/InsuranceRiskPanel";
import RiskThresholdSettings from "@/components/RiskThresholdSettings";
import ComplianceDashboard from "@/components/ComplianceDashboard";
import NotificationSendPanel from "@/components/NotificationSendPanel";
import NotificationAnalyticsDashboard from "@/components/NotificationAnalyticsDashboard";
import { useCircuitIgnitionRisk, usePsaRisk } from "@/hooks/use-backend-data";
import DemoBadge from "@/components/DemoBadge";
import { downloadCsv, formatCircuitRiskCsv } from "@/lib/csv-export";
import { Download } from "lucide-react";

type Tab = "risk-list" | "vegetation" | "insurance" | "thresholds" | "compliance" | "notifications" | "notif-analytics";

const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: "risk-list", label: "Circuit Risk", icon: BarChart3 },
  { key: "vegetation", label: "Vegetation", icon: Layers },
  { key: "insurance", label: "Insurance", icon: DollarSign },
  { key: "thresholds", label: "Thresholds", icon: Settings },
  { key: "compliance", label: "Compliance", icon: Shield },
  { key: "notifications", label: "Send", icon: Bell },
  { key: "notif-analytics", label: "Analytics", icon: BarChart3 },
];

export default function PlanningWorkspace() {
  const [activeTab, setActiveTab] = useState<Tab>("risk-list");
  const circuitRisk = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 100 });
  const psaRisk = usePsaRisk({ limit: 100 });

  const circuitResults = circuitRisk.data?.results ?? circuitRisk.data?.predictions ?? [];
  const isDemo = circuitRisk.data?.demo || psaRisk.data?.demo;

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
        {activeTab === "risk-list" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-400" />
                Circuit Ignition Risk (24h)
                {isDemo && <DemoBadge />}
              </h3>
              {circuitResults.length > 0 && (
                <button
                  onClick={() => downloadCsv(formatCircuitRiskCsv(circuitResults), "planning-circuit-risk.csv")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              )}
            </div>
            {circuitRisk.isLoading ? (
              <p className="text-xs text-white/30 py-8 text-center">Loading…</p>
            ) : circuitResults.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                      <th className="px-3 py-2">Circuit</th>
                      <th className="px-3 py-2">PSA</th>
                      <th className="px-3 py-2">Probability</th>
                      <th className="px-3 py-2">Risk Band</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {circuitResults.map((r: any, i: number) => {
                      const prob = r.prob_spike ?? r.probability ?? 0;
                      const band = r.risk_band ?? "LOW";
                      return (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono">{r.circuit_id}</td>
                          <td className="px-3 py-2">{r.psa_id ?? "—"}</td>
                          <td className="px-3 py-2 font-mono">{(prob * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              band === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                              band === "HIGH" ? "bg-orange-500/15 text-orange-300" :
                              band === "MODERATE" ? "bg-amber-500/15 text-amber-300" :
                              "bg-emerald-500/15 text-emerald-300"
                            }`}>{band}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-white/30 py-4 text-center">No circuit risk data available.</p>
            )}
          </div>
        )}
        {activeTab === "vegetation" && <VegetationRiskPanel />}
        {activeTab === "insurance" && <InsuranceRiskPanel fires={[]} hvraAssets={[]} />}
        {activeTab === "thresholds" && <RiskThresholdSettings />}
        {activeTab === "compliance" && <ComplianceDashboard />}
        {activeTab === "notifications" && <NotificationSendPanel />}
        {activeTab === "notif-analytics" && <NotificationAnalyticsDashboard />}
      </div>
    </div>
  );
}

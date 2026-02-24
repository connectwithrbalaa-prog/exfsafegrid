import { useMemo, useCallback } from "react";
import { AlertTriangle, Users, Zap, TrendingUp, ShieldAlert, Activity, MapPin, Battery, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SUBSTATIONS, TRANSMISSION_LINES } from "@/lib/wildfire-utils";

interface CircuitOutagePanelProps {
  circuitRiskMap: Map<string, { prob: number; band: string }>;
  psaRiskMap: Map<string, { prob: number; bucket: string }>;
  customers: { hftd_tier: string; zip_code: string; medical_baseline?: boolean; has_portable_battery?: boolean; has_permanent_battery?: string }[];
}

interface SubstationImpact {
  id: string;
  name: string;
  zone: string;
  voltage: string;
  capacityMW: number;
  status: string;
  ignitionProb: number;
  ignitionBand: string;
  psaProb: number;
  psaBucket: string;
  customersAffected: number;
  medicalBaseline: number;
  hftdTier: string;
  outageProb: number;
  estimatedRestorationHrs: number;
  hasBatteryBackup: number;
}

const IMPACT_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  Critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/25", bar: "bg-red-500" },
  High: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25", bar: "bg-orange-500" },
  Elevated: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25", bar: "bg-amber-500" },
  Low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", bar: "bg-emerald-500" },
};

function getImpactBand(prob: number): string {
  if (prob >= 0.75) return "Critical";
  if (prob >= 0.5) return "High";
  if (prob >= 0.25) return "Elevated";
  return "Low";
}

function estimateRestoration(capacityMW: number, ignitionProb: number, hftdTier: string): number {
  let base = capacityMW > 300 ? 8 : capacityMW > 150 ? 5 : 3;
  if (ignitionProb > 0.75) base *= 2;
  else if (ignitionProb > 0.5) base *= 1.5;
  if (hftdTier === "Tier 3") base *= 1.3;
  return Math.round(base);
}

export default function CircuitOutagePanel({ circuitRiskMap, psaRiskMap, customers }: CircuitOutagePanelProps) {
  const impacts = useMemo<SubstationImpact[]>(() => {
    return SUBSTATIONS.map((ss) => {
      const ignition = circuitRiskMap.get(ss.id) || { prob: 0, band: "Low" };
      const psa = psaRiskMap.get(ss.id) || { prob: 0, bucket: "Low" };

      const servedCustomers = customers.filter((c) => ss.servesZips.includes(c.zip_code));
      const medicalBaseline = servedCustomers.filter((c) => c.medical_baseline).length;
      const hasBattery = servedCustomers.filter((c) =>
        c.has_portable_battery || (c.has_permanent_battery && c.has_permanent_battery !== "None")
      ).length;

      const tierRank: Record<string, number> = { "Tier 3": 3, "Tier 2": 2, "Tier 1": 1, "None": 0 };
      let bestTier = "None";
      servedCustomers.forEach((c) => {
        if ((tierRank[c.hftd_tier] ?? 0) > (tierRank[bestTier] ?? 0)) bestTier = c.hftd_tier;
      });

      const outageProb = Math.min(1, ignition.prob * 0.7 + psa.prob * 0.3);
      const restorationHrs = estimateRestoration(ss.capacityMW, ignition.prob, bestTier);

      return {
        id: ss.id,
        name: ss.name,
        zone: ss.zone,
        voltage: ss.voltage,
        capacityMW: ss.capacityMW,
        status: ss.status,
        ignitionProb: ignition.prob,
        ignitionBand: ignition.band,
        psaProb: psa.prob,
        psaBucket: psa.bucket,
        customersAffected: servedCustomers.length,
        medicalBaseline,
        hftdTier: bestTier,
        outageProb,
        estimatedRestorationHrs: restorationHrs,
        hasBatteryBackup: hasBattery,
      };
    }).sort((a, b) => b.outageProb - a.outageProb);
  }, [circuitRiskMap, psaRiskMap, customers]);

  const totalCustomersAtRisk = impacts.filter((i) => i.outageProb >= 0.25).reduce((s, i) => s + i.customersAffected, 0);
  const criticalSubs = impacts.filter((i) => i.outageProb >= 0.75).length;
  const highSubs = impacts.filter((i) => i.outageProb >= 0.5 && i.outageProb < 0.75).length;
  const medicalAtRisk = impacts.filter((i) => i.outageProb >= 0.25).reduce((s, i) => s + i.medicalBaseline, 0);
  const totalCapacityAtRisk = impacts.filter((i) => i.outageProb >= 0.5).reduce((s, i) => s + i.capacityMW, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Zap className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Predictive Outage Assessment</h3>
          <p className="text-[11px] text-white/40">
            Customer impact estimates from ML ignition risk × grid topology
          </p>
        </div>
        <button
          onClick={() => {
            const rows = [
              ["Substation", "ID", "Zone", "Voltage", "Capacity_MW", "Status", "HFTD_Tier", "Outage_Prob_%", "Ignition_Prob_%", "PSA_Prob_%", "Customers_Affected", "Medical_Baseline", "Battery_Backup", "Est_Restoration_Hrs"],
              ...impacts.map((i) => [
                i.name, i.id, `"${i.zone}"`, i.voltage, i.capacityMW, i.status, i.hftdTier,
                (i.outageProb * 100).toFixed(1), (i.ignitionProb * 100).toFixed(1), (i.psaProb * 100).toFixed(1),
                i.customersAffected, i.medicalBaseline, i.hasBatteryBackup, i.estimatedRestorationHrs,
              ]),
            ];
            const csv = rows.map((r) => r.join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `outage-impact-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Customers at Risk</span>
          </div>
          <span className="text-xl font-bold text-white">{totalCustomersAtRisk.toLocaleString()}</span>
          <span className="text-[10px] text-white/30 ml-1">≥25% outage prob</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Critical Circuits</span>
          </div>
          <span className="text-xl font-bold text-white">{criticalSubs}</span>
          <span className="text-[10px] text-white/30 ml-1">≥75% · {highSubs} high</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Medical Baseline</span>
          </div>
          <span className="text-xl font-bold text-white">{medicalAtRisk}</span>
          <span className="text-[10px] text-white/30 ml-1">in risk zones</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Capacity at Risk</span>
          </div>
          <span className="text-xl font-bold text-white">{totalCapacityAtRisk.toLocaleString()}</span>
          <span className="text-[10px] text-white/30 ml-1">MW (≥50% prob)</span>
        </div>
      </div>

      {/* Substation impact cards */}
      <div className="space-y-2">
        {impacts.map((imp) => {
          const band = getImpactBand(imp.outageProb);
          const style = IMPACT_COLORS[band];
          const probPct = (imp.outageProb * 100).toFixed(0);

          return (
            <div key={imp.id} className={`rounded-lg border ${style.border} ${style.bg} p-4 transition-colors`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${style.text}`} />
                    <span className="text-sm font-semibold text-white">{imp.name}</span>
                    <Badge variant="outline" className={`text-[9px] ${style.text} ${style.border}`}>{band}</Badge>
                    {imp.status === "Reduced" && (
                      <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">Reduced</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{imp.zone}</span>
                    <span>{imp.voltage} · {imp.capacityMW} MW</span>
                    {imp.hftdTier !== "None" && (
                      <span className={imp.hftdTier === "Tier 3" ? "text-red-400" : imp.hftdTier === "Tier 2" ? "text-orange-400" : "text-amber-400"}>
                        {imp.hftdTier}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold font-mono ${style.text}`}>{probPct}%</div>
                  <div className="text-[10px] text-white/30">outage prob</div>
                </div>
              </div>

              {/* Probability bar */}
              <div className="mb-3">
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, imp.outageProb * 100)}%` }}
                  />
                </div>
              </div>

              {/* Impact metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-white/30" />
                  <span className="text-white/50">Customers:</span>
                  <span className="font-medium text-white/80">{imp.customersAffected}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-rose-400/60" />
                  <span className="text-white/50">Medical:</span>
                  <span className={`font-medium ${imp.medicalBaseline > 0 ? "text-rose-400" : "text-white/40"}`}>{imp.medicalBaseline}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Battery className="w-3 h-3 text-white/30" />
                  <span className="text-white/50">Battery:</span>
                  <span className="font-medium text-white/80">{imp.hasBatteryBackup}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-orange-400/60" />
                  <span className="text-white/50">Ignition:</span>
                  <span className={`font-mono font-medium ${style.text}`}>{(imp.ignitionProb * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-violet-400/60" />
                  <span className="text-white/50">ETA restore:</span>
                  <span className="font-medium text-white/80">~{imp.estimatedRestorationHrs}h</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology */}
      <p className="text-[10px] text-white/20 text-center pt-2">
        Outage probability = 0.7 × Ignition Risk + 0.3 × PSA Risk · Restoration estimates based on capacity, HFTD tier, and risk severity
      </p>
    </div>
  );
}

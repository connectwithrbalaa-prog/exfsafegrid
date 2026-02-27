import React from "react";
/**
 * FieldOpsPanel — BRD 5.7 Field Operations
 * Patrol priority queue ranking circuits by:
 *   1. HFTD Tier 3 status
 *   2. Red flag weather conditions
 *   3. Ignition probability (24h)
 * Includes staging area recommendations and crew assignment readiness.
 */
import { useMemo, useState } from "react";
import { useCircuitIgnitionRisk } from "@/hooks/use-backend-data";
import {
  SUBSTATIONS, haversineKm, type EnrichedFire, type Substation,
} from "@/lib/wildfire-utils";
import { downloadCsv } from "@/lib/csv-export";
import {
  AlertTriangle, CheckCircle, Clock, Download, Filter,
  Loader2, MapPin, Shield, Users, Zap,
} from "lucide-react";
import InlineTrendBadge from "@/components/InlineTrendBadge";
import CircuitRiskTrendRow from "@/components/CircuitRiskTrendRow";

/* ── Types ──────────────────────────────────────────────────── */

interface PatrolCircuit {
  circuit_id: string;
  psa_id: string;
  prob_spike: number;
  risk_band: string;
  hftd_tier: string;
  customer_count: number;
  critical_customers: number;
  county: string;
  // Computed
  isHftd3: boolean;
  isRedFlag: boolean;
  priorityScore: number;
  priorityLabel: "P1 — Immediate" | "P2 — Urgent" | "P3 — Scheduled" | "P4 — Routine";
  stagingArea: Substation | null;
  estimatedPatrolHrs: number;
}

interface Props {
  fires?: EnrichedFire[];
  weatherData?: { humidity?: number; wind_speed?: number; temperature?: number } | null;
}

/* ── Priority scoring ──────────────────────────────────────── */

function computePriority(
  hftd_tier: string,
  prob: number,
  isRedFlag: boolean,
  customerCount: number,
  criticalCustomers: number,
): number {
  let score = 0;
  // HFTD Tier 3 = highest weight
  if (hftd_tier === "Tier 3" || hftd_tier === "3") score += 40;
  else if (hftd_tier === "Tier 2" || hftd_tier === "2") score += 20;
  else if (hftd_tier === "Tier 1" || hftd_tier === "1") score += 10;

  // Red flag weather multiplier
  if (isRedFlag) score += 25;

  // Ignition probability (0-1 → 0-25 points)
  score += prob * 25;

  // Customer density bonus (up to 10 points)
  score += Math.min(customerCount / 1000, 1) * 7;
  score += Math.min(criticalCustomers / 50, 1) * 3;

  return Math.round(score * 10) / 10;
}

function getPriorityLabel(score: number): PatrolCircuit["priorityLabel"] {
  if (score >= 70) return "P1 — Immediate";
  if (score >= 45) return "P2 — Urgent";
  if (score >= 25) return "P3 — Scheduled";
  return "P4 — Routine";
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "P1 — Immediate": { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400" },
  "P2 — Urgent": { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400" },
  "P3 — Scheduled": { bg: "bg-amber-500/15", text: "text-amber-300", dot: "bg-amber-400" },
  "P4 — Routine": { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
};

/* ── Staging area matching ─────────────────────────────────── */

function findStagingArea(county: string): Substation | null {
  // Match by rough county→zone mapping
  const countyLower = county?.toLowerCase() || "";
  if (countyLower.includes("fresno") || countyLower.includes("madera")) return SUBSTATIONS.find(s => s.id === "SS-101") || null;
  if (countyLower.includes("tulare") || countyLower.includes("kern")) return SUBSTATIONS.find(s => s.id === "SS-103") || null;
  if (countyLower.includes("santa clara") || countyLower.includes("san mateo")) return SUBSTATIONS.find(s => s.id === "SS-201") || null;
  if (countyLower.includes("sonoma") || countyLower.includes("napa")) return SUBSTATIONS.find(s => s.id === "SS-301") || null;
  if (countyLower.includes("nevada") || countyLower.includes("placer")) return SUBSTATIONS.find(s => s.id === "SS-401") || null;
  if (countyLower.includes("alameda") || countyLower.includes("contra costa")) return SUBSTATIONS.find(s => s.id === "SS-302") || null;
  if (countyLower.includes("san francisco")) return SUBSTATIONS.find(s => s.id === "SS-203") || null;
  // Fallback to nearest
  return SUBSTATIONS[0];
}

/* ── Component ─────────────────────────────────────────────── */

export default function FieldOpsPanel({ fires, weatherData }: Props) {
  const circuitRisk = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 100 });
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [showHftd3Only, setShowHftd3Only] = useState(false);
  const [expandedCircuit, setExpandedCircuit] = useState<string | null>(null);

  // Detect red flag conditions from weather data
  const isRedFlag = useMemo(() => {
    if (!weatherData) return false;
    const lowHumidity = (weatherData.humidity ?? 100) < 20;
    const highWind = (weatherData.wind_speed ?? 0) > 40;
    return lowHumidity || highWind;
  }, [weatherData]);

  // Mock fallback data for demo mode
  const MOCK_CIRCUITS = useMemo(() => [
    { circuit_id: "CKT-2201", psa_id: "PSA-CA06", prob_spike: 0.82, risk_band: "CRITICAL", hftd_tier: "Tier 3", customer_count: 4200, critical_customers: 38, county: "Sonoma" },
    { circuit_id: "CKT-2205", psa_id: "PSA-CA06", prob_spike: 0.74, risk_band: "CRITICAL", hftd_tier: "Tier 3", customer_count: 3100, critical_customers: 22, county: "Napa" },
    { circuit_id: "CKT-1103", psa_id: "PSA-CA04", prob_spike: 0.65, risk_band: "HIGH", hftd_tier: "Tier 2", customer_count: 5600, critical_customers: 45, county: "Fresno" },
    { circuit_id: "CKT-3301", psa_id: "PSA-CA09", prob_spike: 0.58, risk_band: "HIGH", hftd_tier: "Tier 3", customer_count: 2800, critical_customers: 15, county: "Nevada" },
    { circuit_id: "CKT-1407", psa_id: "PSA-CA05", prob_spike: 0.51, risk_band: "ELEVATED", hftd_tier: "Tier 2", customer_count: 7200, critical_customers: 60, county: "Tulare" },
    { circuit_id: "CKT-2102", psa_id: "PSA-CA07", prob_spike: 0.44, risk_band: "ELEVATED", hftd_tier: "Tier 1", customer_count: 3400, critical_customers: 12, county: "Santa Clara" },
    { circuit_id: "CKT-2503", psa_id: "PSA-CA08", prob_spike: 0.37, risk_band: "ELEVATED", hftd_tier: "Tier 2", customer_count: 1900, critical_customers: 8, county: "Alameda" },
    { circuit_id: "CKT-1602", psa_id: "PSA-CA04", prob_spike: 0.29, risk_band: "NORMAL", hftd_tier: "Tier 1", customer_count: 6100, critical_customers: 30, county: "Kern" },
    { circuit_id: "CKT-2801", psa_id: "PSA-CA07", prob_spike: 0.18, risk_band: "NORMAL", hftd_tier: "None", customer_count: 8500, critical_customers: 5, county: "San Mateo" },
    { circuit_id: "CKT-3105", psa_id: "PSA-CA10", prob_spike: 0.11, risk_band: "NORMAL", hftd_tier: "None", customer_count: 4700, critical_customers: 2, county: "San Francisco" },
  ], []);

  // Build patrol queue
  const patrolQueue = useMemo<PatrolCircuit[]>(() => {
    const sourceData = circuitRisk.data?.results?.length ? circuitRisk.data.results : MOCK_CIRCUITS;

    return sourceData
      .map((r: any) => {
        const isHftd3 = r.hftd_tier === "Tier 3" || r.hftd_tier === "3";
        const prob = r.prob_spike ?? 0;
        const customerCount = r.customer_count ?? 0;
        const criticalCustomers = r.critical_customers ?? 0;
        const priorityScore = computePriority(r.hftd_tier || "", prob, isRedFlag, customerCount, criticalCustomers);
        const priorityLabel = getPriorityLabel(priorityScore);
        const stagingArea = findStagingArea(r.county || "");
        // Estimate patrol hours: higher priority = more time needed
        const estimatedPatrolHrs = priorityScore >= 70 ? 4 : priorityScore >= 45 ? 3 : priorityScore >= 25 ? 2 : 1;

        return {
          circuit_id: r.circuit_id,
          psa_id: r.psa_id,
          prob_spike: prob,
          risk_band: r.risk_band || "",
          hftd_tier: r.hftd_tier || "None",
          customer_count: customerCount,
          critical_customers: criticalCustomers,
          county: r.county || "",
          isHftd3,
          isRedFlag,
          priorityScore,
          priorityLabel,
          stagingArea,
          estimatedPatrolHrs,
        } as PatrolCircuit;
      })
      .sort((a: PatrolCircuit, b: PatrolCircuit) => b.priorityScore - a.priorityScore);
  }, [circuitRisk.data, isRedFlag, MOCK_CIRCUITS]);

  const filtered = useMemo(() => {
    let list = patrolQueue;
    if (showHftd3Only) list = list.filter(c => c.isHftd3);
    if (filterPriority !== "All") list = list.filter(c => c.priorityLabel.startsWith(filterPriority));
    return list;
  }, [patrolQueue, filterPriority, showHftd3Only]);

  // Summary stats
  const p1Count = patrolQueue.filter(c => c.priorityLabel.startsWith("P1")).length;
  const p2Count = patrolQueue.filter(c => c.priorityLabel.startsWith("P2")).length;
  const hftd3Count = patrolQueue.filter(c => c.isHftd3).length;
  const totalCrewHrs = filtered.reduce((sum, c) => sum + c.estimatedPatrolHrs, 0);

  if (circuitRisk.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-white/30">
        <Loader2 className="w-4 h-4 animate-spin" /> Building patrol priority queue…
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Red Flag Banner */}
      {isRedFlag && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-red-300">Red Flag Weather Active</span>
            <span className="text-xs text-red-300/60 ml-2">
              {weatherData?.humidity != null && `Humidity: ${weatherData.humidity}%`}
              {weatherData?.wind_speed != null && ` · Wind: ${weatherData.wind_speed} km/h`}
            </span>
          </div>
          <span className="ml-auto text-[10px] text-red-400/60 uppercase tracking-wider font-semibold">+25 priority boost applied</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <div className="text-[10px] uppercase tracking-wider text-white/30 font-medium">P1 Immediate</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{p1Count}</div>
        </div>
        <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
          <div className="text-[10px] uppercase tracking-wider text-white/30 font-medium">P2 Urgent</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{p2Count}</div>
        </div>
        <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[10px] uppercase tracking-wider text-white/30 font-medium">HFTD Tier 3</div>
          <div className="text-2xl font-bold text-white/80 mt-1">{hftd3Count}</div>
        </div>
        <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Total Circuits</div>
          <div className="text-2xl font-bold text-white/80 mt-1">{filtered.length}</div>
        </div>
        <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[10px] uppercase tracking-wider text-white/30 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Est. Crew Hours</div>
          <div className="text-2xl font-bold text-white/80 mt-1">{totalCrewHrs}h</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30 font-medium">
          <Filter className="w-3 h-3" /> Filter:
        </div>
        {["All", "P1", "P2", "P3", "P4"].map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(p)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              filterPriority === p
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
            }`}
          >
            {p === "All" ? "All Priorities" : p}
          </button>
        ))}
        <span className="text-white/10">|</span>
        <button
          onClick={() => setShowHftd3Only(!showHftd3Only)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            showHftd3Only
              ? "bg-red-500/15 border-red-500/30 text-red-300"
              : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
          }`}
        >
          HFTD Tier 3 Only
        </button>
        <div className="ml-auto">
          <button
            onClick={() => downloadCsv(
              filtered.map(c => ({
                priority: c.priorityLabel,
                score: c.priorityScore,
                circuit_id: c.circuit_id,
                psa_id: c.psa_id,
                hftd_tier: c.hftd_tier,
                ignition_prob: (c.prob_spike * 100).toFixed(1) + "%",
                risk_band: c.risk_band,
                customers: c.customer_count,
                critical_customers: c.critical_customers,
                county: c.county,
                staging_area: c.stagingArea?.name || "",
                est_hours: c.estimatedPatrolHrs,
                red_flag: c.isRedFlag ? "YES" : "NO",
              })),
              "patrol-priority-queue.csv"
            )}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
          >
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Circuit</th>
              <th className="px-4 py-3">HFTD</th>
              <th className="px-4 py-3">Ignition Prob</th>
              <th className="px-4 py-3">Risk Band</th>
              <th className="px-4 py-3">Customers</th>
              <th className="px-4 py-3">County</th>
              <th className="px-4 py-3">Staging Area</th>
              <th className="px-4 py-3">Est. Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((c, i) => {
              const pColors = PRIORITY_COLORS[c.priorityLabel] || PRIORITY_COLORS["P4 — Routine"];
              const isExpanded = expandedCircuit === c.circuit_id;
              return (
                <React.Fragment key={c.circuit_id}>
                <tr key={c.circuit_id} className={`transition-colors ${
                  c.priorityLabel.startsWith("P1") ? "bg-red-500/[0.04] hover:bg-red-500/[0.08]" : "hover:bg-white/[0.02]"
                }`}>
                  <td className="px-4 py-2.5 font-mono text-white/30">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${pColors.bg} ${pColors.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pColors.dot}`} />
                      {c.priorityLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold">{c.priorityScore}</td>
                  <td className="px-4 py-2.5 font-mono">
                    <span className="flex items-center gap-1.5">
                      {c.circuit_id}
                      <InlineTrendBadge
                        circuitId={c.circuit_id}
                        onClick={() => setExpandedCircuit(isExpanded ? null : c.circuit_id)}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold ${
                      c.isHftd3 ? "text-red-400" : c.hftd_tier.includes("2") ? "text-orange-400" : "text-white/40"
                    }`}>
                      {c.hftd_tier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{(c.prob_spike * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.risk_band === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                      c.risk_band === "HIGH" ? "bg-orange-500/15 text-orange-300" :
                      c.risk_band === "ELEVATED" ? "bg-amber-500/15 text-amber-300" :
                      "bg-emerald-500/15 text-emerald-300"
                    }`}>{c.risk_band}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-white/30" />
                      {c.customer_count.toLocaleString()}
                      {c.critical_customers > 0 && (
                        <span className="text-red-400 text-[10px]">({c.critical_customers} crit)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/50">{c.county || "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.stagingArea ? (
                      <span className="flex items-center gap-1 text-white/60">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        {c.stagingArea.name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{c.estimatedPatrolHrs}h</td>
                </tr>
                {isExpanded && (
                  <CircuitRiskTrendRow circuitId={c.circuit_id} onClose={() => setExpandedCircuit(null)} />
                )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Scoring Legend */}
      <div className="text-[10px] text-white/20 leading-relaxed p-3 rounded-lg border border-white/[0.06] bg-white/[0.01]">
        <strong className="text-white/30">Priority Scoring:</strong>{" "}
        HFTD Tier 3 (+40) · Tier 2 (+20) · Tier 1 (+10) · Red Flag Weather (+25) · Ignition Prob (0–25) · Customer Density (0–10).{" "}
        <strong className="text-white/30">Thresholds:</strong>{" "}
        P1 ≥ 70 · P2 ≥ 45 · P3 ≥ 25 · P4 &lt; 25.
      </div>
    </div>
  );
}

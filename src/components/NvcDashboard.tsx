import { useMemo, useState } from "react";
import {
  BarChart3, TrendingUp, AlertTriangle, Shield, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { haversineKm, type FirePoint, RISK_COLORS, type RiskLevel } from "@/lib/wildfire-utils";
import { CATEGORY_CONFIG, type HvraAsset } from "@/components/HvraPanel";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie,
} from "recharts";

/* ── WFDSS NVC Model ─────────────────────────────────────────
 *
 * E(NVC) = Σ BP(i) × P(FLi) × Rf(category, FLi) × W
 *
 * Where:
 *   BP  = Burn Probability — derived from fire proximity & density
 *   FLi = Fire Intensity Level (1–6, mapped from FRP watts/m²)
 *   Rf  = Response Function — category-specific loss at each FLi
 *   W   = Relative Importance weight (0–10)
 * ──────────────────────────────────────────────────────────── */

/* Fire Intensity Levels mapped from FRP */
const FRP_THRESHOLDS = [0.5, 2, 5, 10, 20, 50]; // FRP breakpoints → FL1–FL6

function getFIL(frp: number): number {
  for (let i = FRP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (frp >= FRP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/* Response function values by category & response type per FL level */
const RESPONSE_FUNCTIONS: Record<string, number[]> = {
  // [FL1, FL2, FL3, FL4, FL5, FL6] — proportion of value lost
  susceptible:  [0.05, 0.15, 0.35, 0.55, 0.80, 1.00],
  adaptable:    [0.02, 0.08, 0.18, 0.30, 0.50, 0.70],
  resistant:    [0.01, 0.03, 0.08, 0.15, 0.25, 0.40],
};

/* Burn Probability model: proximity-based with fire density factor */
function calcBurnProbability(distKm: number, fireCount: number): number {
  if (distKm < 0) return 0;
  // Base BP from distance (exponential decay)
  const baseBP = Math.max(0, Math.exp(-distKm / 15));
  // Density modifier: more fires nearby = higher BP
  const densityMod = 1 + Math.min(fireCount * 0.05, 0.5);
  return Math.min(baseBP * densityMod, 1.0);
}

/* P(FLi) — probability distribution of fire intensity levels near asset */
function calcFILDistribution(nearbyFires: FirePoint[]): number[] {
  const dist = [0, 0, 0, 0, 0, 0]; // FL1–FL6
  if (nearbyFires.length === 0) return [1, 0, 0, 0, 0, 0]; // default to FL1
  for (const f of nearbyFires) {
    const fl = getFIL(f.frp);
    dist[fl - 1]++;
  }
  const total = dist.reduce((s, v) => s + v, 0);
  return dist.map((v) => v / total);
}

/* ── Full NVC computation per asset ──────────────────────────── */

export interface NvcResult {
  asset: HvraAsset;
  burnProbability: number;
  filDistribution: number[];
  dominantFIL: number;
  responseLosses: number[]; // loss at each FL
  expectedNVC: number; // the final score
  nearestFireKm: number;
  nearbyFireCount: number;
  riskCategory: "Extreme" | "High" | "Moderate" | "Low" | "Minimal";
}

function computeNVC(assets: HvraAsset[], fires: FirePoint[]): NvcResult[] {
  return assets.map((a) => {
    // Find fires within 50km
    let nearestKm = Infinity;
    const nearbyFires: FirePoint[] = [];
    for (const f of fires) {
      const d = haversineKm(a.latitude, a.longitude, f.latitude, f.longitude);
      if (d < nearestKm) nearestKm = d;
      if (d <= 50) nearbyFires.push(f);
    }

    const bp = calcBurnProbability(nearestKm < Infinity ? nearestKm : -1, nearbyFires.length);
    const filDist = calcFILDistribution(nearbyFires);
    const rf = RESPONSE_FUNCTIONS[a.response_function] || RESPONSE_FUNCTIONS.susceptible;

    // E(NVC) = BP × Σ P(FLi) × Rf(FLi) × W
    let expectedNVC = 0;
    const responseLosses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const loss = bp * filDist[i] * rf[i] * a.importance_weight;
      responseLosses.push(loss);
      expectedNVC += loss;
    }

    const dominantFIL = filDist.indexOf(Math.max(...filDist)) + 1;

    let riskCategory: NvcResult["riskCategory"];
    if (expectedNVC >= 3.0) riskCategory = "Extreme";
    else if (expectedNVC >= 1.5) riskCategory = "High";
    else if (expectedNVC >= 0.5) riskCategory = "Moderate";
    else if (expectedNVC >= 0.1) riskCategory = "Low";
    else riskCategory = "Minimal";

    return {
      asset: a,
      burnProbability: bp,
      filDistribution: filDist,
      dominantFIL,
      responseLosses,
      expectedNVC: Math.round(expectedNVC * 1000) / 1000,
      nearestFireKm: nearestKm < Infinity ? nearestKm : -1,
      nearbyFireCount: nearbyFires.length,
      riskCategory,
    };
  }).sort((a, b) => b.expectedNVC - a.expectedNVC);
}

/* ── Risk category config ────────────────────────────────────── */

const RISK_CAT_CONFIG: Record<string, { color: string; bg: string }> = {
  Extreme: { color: "#DC2626", bg: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40" },
  High: { color: "#F97316", bg: "bg-orange-500/15 text-orange-300" },
  Moderate: { color: "#EAB308", bg: "bg-amber-500/15 text-amber-300" },
  Low: { color: "#22C55E", bg: "bg-emerald-500/15 text-emerald-300" },
  Minimal: { color: "#6B7280", bg: "bg-white/5 text-white/40" },
};

/* ── Component ────────────────────────────────────────────────── */

interface NvcDashboardProps {
  fires: FirePoint[];
  hvraAssets: HvraAsset[];
}

export default function NvcDashboard({ fires, hvraAssets }: NvcDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"expectedNVC" | "burnProbability" | "importance_weight">("expectedNVC");
  const [sortAsc, setSortAsc] = useState(false);

  const results = useMemo(() => computeNVC(hvraAssets, fires), [hvraAssets, fires]);

  const sorted = useMemo(() => {
    const list = [...results];
    list.sort((a, b) => {
      const aVal = sortField === "importance_weight" ? a.asset.importance_weight : a[sortField];
      const bVal = sortField === "importance_weight" ? b.asset.importance_weight : b[sortField];
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [results, sortField, sortAsc]);

  /* Summary stats */
  const summary = useMemo(() => {
    const extreme = results.filter((r) => r.riskCategory === "Extreme").length;
    const high = results.filter((r) => r.riskCategory === "High").length;
    const totalNVC = results.reduce((s, r) => s + r.expectedNVC, 0);
    const avgBP = results.length ? results.reduce((s, r) => s + r.burnProbability, 0) / results.length : 0;
    return { extreme, high, totalNVC: Math.round(totalNVC * 100) / 100, avgBP: Math.round(avgBP * 1000) / 10 };
  }, [results]);

  /* Chart data */
  const barData = useMemo(() =>
    results.slice(0, 12).map((r) => ({
      name: r.asset.name.length > 18 ? r.asset.name.slice(0, 16) + "…" : r.asset.name,
      fullName: r.asset.name,
      nvc: r.expectedNVC,
      bp: Math.round(r.burnProbability * 100),
      category: r.riskCategory,
      color: RISK_CAT_CONFIG[r.riskCategory].color,
    })),
  [results]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach((r) => { counts[r.riskCategory] = (counts[r.riskCategory] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({
      name, value, color: RISK_CAT_CONFIG[name].color,
    }));
  }, [results]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="space-y-5">
      {/* ── Formula Explainer ──────────────────────────────── */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-white/60 leading-relaxed">
              <span className="font-semibold text-white/80">WFDSS Net Value Change Model:</span>{" "}
              <span className="font-mono text-blue-300">E(NVC) = BP × Σ P(FLᵢ) × Rf(FLᵢ) × W</span>
            </p>
            <p className="text-[10px] text-white/30 mt-1">
              BP = Burn Probability (distance + density) · FLᵢ = Fire Intensity Level 1–6 (from FRP) · Rf = Response Function (susceptible/adaptable/resistant) · W = Importance Weight
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Extreme Risk"
          value={String(summary.extreme)}
          highlight={summary.extreme > 0}
        />
        <SummaryCard
          icon={<TrendingUp className="w-4 h-4 text-orange-400" />}
          label="High Risk"
          value={String(summary.high)}
          highlight={summary.high > 0}
        />
        <SummaryCard
          icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
          label="Aggregate NVC"
          value={summary.totalNVC.toFixed(1)}
        />
        <SummaryCard
          icon={<Shield className="w-4 h-4 text-emerald-400" />}
          label="Avg Burn Prob."
          value={`${summary.avgBP}%`}
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* NVC Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-4">
          <h3 className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">E(NVC) by Asset</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220,25%,12%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number, name: string) => [value.toFixed(3), name === "nvc" ? "E(NVC)" : name]}
                  labelFormatter={(label: string) => barData.find((d) => d.name === label)?.fullName || label}
                />
                <Bar dataKey="nvc" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Pie */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-4">
          <h3 className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">Risk Distribution</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220,25%,12%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-white/40">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detailed Table ────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            NVC Analysis per Asset
          </h3>
          <span className="text-[10px] text-white/30">{results.length} assets analyzed</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                <th className="px-5 py-3 font-medium w-6"></th>
                <th className="px-5 py-3 font-medium">Asset</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("importance_weight")}>
                  Weight <SortIcon field="importance_weight" />
                </th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("burnProbability")}>
                  Burn Prob. <SortIcon field="burnProbability" />
                </th>
                <th className="px-5 py-3 font-medium">Dom. FIL</th>
                <th className="px-5 py-3 font-medium">Response</th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("expectedNVC")}>
                  E(NVC) <SortIcon field="expectedNVC" />
                </th>
                <th className="px-5 py-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map((r) => {
                const cfg = CATEGORY_CONFIG[r.asset.category] || { icon: Shield, color: "text-white/40" };
                const Icon = cfg.icon;
                const catConfig = RISK_CAT_CONFIG[r.riskCategory];
                const isExpanded = expandedId === r.asset.id;

                return (
                  <>
                    <tr
                      key={r.asset.id}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : r.asset.id)}
                    >
                      <td className="px-3 py-3 text-white/20">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium">{r.asset.name}</div>
                        <div className="text-[10px] text-white/25">
                          {r.nearbyFireCount} fires within 50km
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-xs">{r.asset.category}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ImportanceBar weight={r.asset.importance_weight} />
                      </td>
                      <td className="px-5 py-3">
                        <BurnProbBar value={r.burnProbability} />
                      </td>
                      <td className="px-5 py-3">
                        <FILBadge level={r.dominantFIL} />
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.asset.response_function === "susceptible" ? "bg-red-500/15 text-red-300" :
                          r.asset.response_function === "adaptable" ? "bg-amber-500/15 text-amber-300" :
                          "bg-emerald-500/15 text-emerald-300"
                        }`}>
                          {r.asset.response_function}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-sm font-bold" style={{ color: catConfig.color }}>
                          {r.expectedNVC.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${catConfig.bg}`}>
                          {r.riskCategory}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.asset.id}-detail`} className="bg-white/[0.01]">
                        <td colSpan={9} className="px-8 py-4">
                          <ExpandedDetail result={r} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-white/[0.04] text-[10px] text-white/20">
          E(NVC) = BP × Σ P(FLᵢ) × Rf(FLᵢ) × W · Fire Intensity Levels 1–6 derived from FIRMS FRP data
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function SummaryCard({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-red-500/30 bg-red-500/5" : "border-white/[0.08] bg-[hsl(220,25%,9%)]"}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold tabular-nums ${highlight ? "text-red-400" : "text-white/90"}`}>{value}</span>
    </div>
  );
}

function ImportanceBar({ weight }: { weight: number }) {
  const pct = (weight / 10) * 100;
  const color = weight >= 8 ? "#f87171" : weight >= 6 ? "#fbbf24" : "#4ade80";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono text-white/50">{weight}</span>
    </div>
  );
}

function BurnProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? "#f87171" : pct >= 30 ? "#fbbf24" : pct >= 10 ? "#38bdf8" : "#6b7280";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono text-white/50">{pct}%</span>
    </div>
  );
}

function FILBadge({ level }: { level: number }) {
  const colors = ["#6B7280", "#22C55E", "#EAB308", "#F97316", "#EF4444", "#DC2626"];
  const color = colors[Math.min(level - 1, 5)];
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold border"
      style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}
    >
      {level}
    </span>
  );
}

function ExpandedDetail({ result: r }: { result: NvcResult }) {
  const filLabels = ["FL1", "FL2", "FL3", "FL4", "FL5", "FL6"];
  const rf = RESPONSE_FUNCTIONS[r.asset.response_function] || RESPONSE_FUNCTIONS.susceptible;

  const radarData = filLabels.map((label, i) => ({
    level: label,
    probability: Math.round(r.filDistribution[i] * 100),
    responseLoss: Math.round(rf[i] * 100),
    contribution: Math.round(r.responseLosses[i] * 1000) / 1000,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* FIL Radar */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
          Fire Intensity Distribution
        </h4>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="level" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
              <PolarRadiusAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} />
              <Radar name="P(FLi) %" dataKey="probability" stroke="#60A5FA" fill="#60A5FA" fillOpacity={0.2} />
              <Radar name="Rf Loss %" dataKey="responseLoss" stroke="#F87171" fill="#F87171" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
          NVC Breakdown by Intensity
        </h4>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-white/25">
              <th className="text-left py-1">Level</th>
              <th className="text-right py-1">P(FLᵢ)</th>
              <th className="text-right py-1">Rf</th>
              <th className="text-right py-1">Contrib.</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((d, i) => (
              <tr key={d.level} className="text-white/50">
                <td className="py-0.5">
                  <FILBadge level={i + 1} />
                </td>
                <td className="text-right font-mono">{d.probability}%</td>
                <td className="text-right font-mono">{d.responseLoss}%</td>
                <td className="text-right font-mono font-semibold" style={{ color: d.contribution > 0.1 ? "#f87171" : "inherit" }}>
                  {d.contribution.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
        <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
          Asset Summary
        </h4>
        <StatRow label="Nearest Fire" value={r.nearestFireKm >= 0 ? `${Math.round(r.nearestFireKm * 0.621371)} mi (${r.nearestFireKm.toFixed(1)} km)` : "No fires"} />
        <StatRow label="Fires in 50km" value={String(r.nearbyFireCount)} />
        <StatRow label="Burn Probability" value={`${Math.round(r.burnProbability * 100)}%`} />
        <StatRow label="Dominant FIL" value={`Level ${r.dominantFIL}`} />
        <StatRow label="Response Type" value={r.asset.response_function} />
        <StatRow label="Importance" value={`${r.asset.importance_weight}/10`} />
        {r.asset.population_served > 0 && (
          <StatRow label="Population" value={r.asset.population_served.toLocaleString()} />
        )}
        {r.asset.notes && (
          <p className="text-[10px] text-white/25 pt-1 border-t border-white/[0.04] leading-relaxed">{r.asset.notes}</p>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-white/30">{label}</span>
      <span className="text-white/70 font-medium">{value}</span>
    </div>
  );
}

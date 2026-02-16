import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, TrendingUp, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FirePoint, SUBSTATIONS, haversineKm } from "@/lib/wildfire-utils";
import type { HvraAsset } from "@/components/HvraPanel";

/* ── Types ──────────────────────────────────────────────────── */

interface ZipRiskProfile {
  zip: string;
  hftdTier: string;
  hftdScore: number;
  fireProximityScore: number;
  nearestFireKm: number;
  fireCount: number;
  infraVulnScore: number;
  substationStatus: string;
  substationName: string;
  hvraCount: number;
  compositeScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  premiumMultiplier: number;
}

/* ── ZIP Code Data ──────────────────────────────────────────── */

const ZIP_DATA: {
  zip: string;
  hftdTier: string;
  lat: number;
  lng: number;
  population: number;
  structures: number;
}[] = [
  { zip: "93644", hftdTier: "Tier 3", lat: 37.35, lng: -119.50, population: 4200, structures: 1850 },
  { zip: "93614", hftdTier: "Tier 2", lat: 37.18, lng: -119.68, population: 8100, structures: 3400 },
  { zip: "93623", hftdTier: "Tier 3", lat: 37.50, lng: -119.63, population: 1900, structures: 980 },
  { zip: "93210", hftdTier: "Tier 1", lat: 36.15, lng: -120.35, population: 12500, structures: 5200 },
  { zip: "93242", hftdTier: "None", lat: 36.31, lng: -119.87, population: 6300, structures: 2700 },
  { zip: "93230", hftdTier: "None", lat: 36.32, lng: -119.78, population: 15200, structures: 6100 },
  { zip: "93637", hftdTier: "Tier 2", lat: 37.06, lng: -120.12, population: 7800, structures: 3100 },
  { zip: "93602", hftdTier: "Tier 3", lat: 37.08, lng: -119.50, population: 2100, structures: 920 },
  { zip: "93604", hftdTier: "Tier 2", lat: 37.43, lng: -119.65, population: 1400, structures: 680 },
  { zip: "93654", hftdTier: "Tier 1", lat: 36.63, lng: -119.28, population: 11300, structures: 4800 },
  { zip: "93667", hftdTier: "Tier 2", lat: 36.82, lng: -119.32, population: 3200, structures: 1500 },
  { zip: "93651", hftdTier: "Tier 1", lat: 36.80, lng: -119.40, population: 5600, structures: 2400 },
];

const HFTD_SCORES: Record<string, number> = {
  "Tier 3": 40,
  "Tier 2": 25,
  "Tier 1": 12,
  "None": 3,
};

const GRADE_THRESHOLDS: { min: number; grade: "A" | "B" | "C" | "D" | "F" }[] = [
  { min: 70, grade: "F" },
  { min: 50, grade: "D" },
  { min: 30, grade: "C" },
  { min: 15, grade: "B" },
  { min: 0, grade: "A" },
];

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-sky-400",
  C: "text-amber-400",
  D: "text-orange-400",
  F: "text-red-400",
};

const GRADE_BG: Record<string, string> = {
  A: "bg-emerald-500/15 border-emerald-500/30",
  B: "bg-sky-500/15 border-sky-500/30",
  C: "bg-amber-500/15 border-amber-500/30",
  D: "bg-orange-500/15 border-orange-500/30",
  F: "bg-red-500/15 border-red-500/30",
};

const PREMIUM_MULT: Record<string, number> = {
  A: 1.0,
  B: 1.15,
  C: 1.45,
  D: 1.85,
  F: 2.50,
};

const BAR_COLORS: Record<string, string> = {
  A: "#34D399",
  B: "#38BDF8",
  C: "#FBBF24",
  D: "#FB923C",
  F: "#F87171",
};

/* ── Component ──────────────────────────────────────────────── */

interface Props {
  fires: FirePoint[];
  hvraAssets: HvraAsset[];
}

export default function InsuranceRiskPanel({ fires, hvraAssets }: Props) {
  const [sortKey, setSortKey] = useState<"composite" | "zip" | "hftd" | "fire" | "infra">("composite");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedZip, setExpandedZip] = useState<string | null>(null);

  const profiles = useMemo<ZipRiskProfile[]>(() => {
    return ZIP_DATA.map((z) => {
      // HFTD score (0-40)
      const hftdScore = HFTD_SCORES[z.hftdTier] ?? 3;

      // Fire proximity score (0-35): based on nearest fire and fire density within 30km
      let nearestFireKm = Infinity;
      let fireCount = 0;
      for (const f of fires) {
        const d = haversineKm(z.lat, z.lng, f.latitude, f.longitude);
        if (d < nearestFireKm) nearestFireKm = d;
        if (d <= 30) fireCount++;
      }
      // proximity: 35 if < 5km, decays to 0 at 50km
      const proxPart = nearestFireKm < Infinity
        ? Math.max(0, 35 * (1 - nearestFireKm / 50))
        : 0;
      // density bonus: up to 10 extra for many fires within 30km (capped)
      const densityPart = Math.min(10, fireCount * 1.5);
      const fireProximityScore = Math.min(35, proxPart + densityPart);

      // Infrastructure vulnerability (0-25)
      const servingSS = SUBSTATIONS.find((ss) => ss.servesZips.includes(z.zip));
      const substationStatus = servingSS?.status ?? "Unknown";
      const substationName = servingSS?.name ?? "N/A";
      const statusPenalty = substationStatus === "Offline" ? 15 : substationStatus === "Reduced" ? 8 : 0;
      // HVRA proximity: count HVRA assets within 15km (hospitals, schools = higher vulnerability)
      const nearbyHvra = hvraAssets.filter((a) => haversineKm(z.lat, z.lng, a.latitude, a.longitude) <= 15);
      const hvraPart = Math.min(10, nearbyHvra.length * 2);
      const infraVulnScore = Math.min(25, statusPenalty + hvraPart);

      const compositeScore = Math.round(hftdScore + fireProximityScore + infraVulnScore);
      const grade = GRADE_THRESHOLDS.find((g) => compositeScore >= g.min)?.grade ?? "A";
      const premiumMultiplier = PREMIUM_MULT[grade];

      return {
        zip: z.zip,
        hftdTier: z.hftdTier,
        hftdScore: Math.round(hftdScore),
        fireProximityScore: Math.round(fireProximityScore * 10) / 10,
        nearestFireKm: nearestFireKm < Infinity ? Math.round(nearestFireKm * 10) / 10 : -1,
        fireCount,
        infraVulnScore: Math.round(infraVulnScore * 10) / 10,
        substationStatus,
        substationName,
        hvraCount: nearbyHvra.length,
        compositeScore,
        grade,
        premiumMultiplier,
      };
    });
  }, [fires, hvraAssets]);

  const sorted = useMemo(() => {
    const list = [...profiles];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "composite") cmp = b.compositeScore - a.compositeScore;
      else if (sortKey === "zip") cmp = a.zip.localeCompare(b.zip);
      else if (sortKey === "hftd") cmp = b.hftdScore - a.hftdScore;
      else if (sortKey === "fire") cmp = b.fireProximityScore - a.fireProximityScore;
      else if (sortKey === "infra") cmp = b.infraVulnScore - a.infraVulnScore;
      return sortAsc ? -cmp : cmp;
    });
    return list;
  }, [profiles, sortKey, sortAsc]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-white/15" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-white/50" /> : <ChevronDown className="w-3 h-3 text-white/50" />;
  };

  /* Summary stats */
  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    profiles.forEach((p) => counts[p.grade]++);
    return counts;
  }, [profiles]);

  const avgScore = useMemo(
    () => Math.round(profiles.reduce((s, p) => s + p.compositeScore, 0) / profiles.length),
    [profiles]
  );

  const chartData = useMemo(
    () => sorted.map((p) => ({ zip: p.zip, score: p.compositeScore, grade: p.grade })),
    [sorted]
  );

  return (
    <div className="space-y-5">
      {/* ── Summary ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Avg Score</div>
          <div className="text-xl font-bold tabular-nums text-white/80">{avgScore}<span className="text-xs text-white/30">/100</span></div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">ZIP Codes</div>
          <div className="text-xl font-bold tabular-nums text-white/80">{profiles.length}</div>
        </div>
        {(["A", "B", "C", "D", "F"] as const).map((g) => (
          <div key={g} className={`rounded-lg border px-3 py-2.5 ${GRADE_BG[g]}`}>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Grade {g}</div>
            <div className={`text-xl font-bold tabular-nums ${GRADE_COLORS[g]}`}>{gradeCounts[g]}</div>
          </div>
        ))}
      </div>

      {/* ── Bar Chart ─────────────────────────────────── */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Composite Risk Score by ZIP Code
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="zip" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
              formatter={(v: number) => [`${v}/100`, "Risk Score"]}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={BAR_COLORS[d.grade]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Methodology ──────────────────────────────── */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/40 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/25" />
        <div>
          <span className="font-semibold text-white/50">Score = HFTD (0-40) + Fire Proximity (0-35) + Infrastructure (0-25)</span>
          <span className="block mt-0.5">
            HFTD tier from CPUC classification · Fire proximity from real-time FIRMS detections ·
            Infrastructure considers substation status and nearby HVRA density · Grades: A (&lt;15) B (15-29) C (30-49) D (50-69) F (70+)
          </span>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-medium w-8" />
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("zip")}>
                <span className="inline-flex items-center gap-1">ZIP Code <SortIcon col="zip" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("hftd")}>
                <span className="inline-flex items-center gap-1">HFTD <SortIcon col="hftd" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("fire")}>
                <span className="inline-flex items-center gap-1">Fire Proximity <SortIcon col="fire" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("infra")}>
                <span className="inline-flex items-center gap-1">Infrastructure <SortIcon col="infra" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("composite")}>
                <span className="inline-flex items-center gap-1">Score <SortIcon col="composite" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Grade</th>
              <th className="px-4 py-3 font-medium">Premium ×</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sorted.map((p) => (
              <>
                <tr
                  key={p.zip}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpandedZip(expandedZip === p.zip ? null : p.zip)}
                >
                  <td className="px-4 py-3 text-white/20">
                    {expandedZip === p.zip ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{p.zip}</td>
                  <td className="px-4 py-3">
                    <HftdBadge tier={p.hftdTier} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar value={p.fireProximityScore} max={35} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar value={p.infraVulnScore} max={25} />
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-white/80">{p.compositeScore}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border font-bold text-sm ${GRADE_BG[p.grade]} ${GRADE_COLORS[p.grade]}`}>
                      {p.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{p.premiumMultiplier.toFixed(2)}×</td>
                </tr>
                {expandedZip === p.zip && (
                  <tr key={`${p.zip}-detail`} className="bg-white/[0.01]">
                    <td colSpan={8} className="px-8 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <DetailItem label="HFTD Tier" value={p.hftdTier} sub={`Score: ${p.hftdScore}/40`} />
                        <DetailItem
                          label="Nearest Fire"
                          value={p.nearestFireKm >= 0 ? `${p.nearestFireKm} km` : "None detected"}
                          sub={`${p.fireCount} fires within 30 km`}
                        />
                        <DetailItem label="Serving Substation" value={p.substationName} sub={`Status: ${p.substationStatus}`} />
                        <DetailItem label="Nearby HVRA Assets" value={String(p.hvraCount)} sub={`Within 15 km radius`} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-white/20 px-1">
        Insurance risk model based on CPUC HFTD classification, NASA FIRMS real-time fire data, and infrastructure exposure analysis
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function HftdBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    "Tier 3": "bg-red-500/20 text-red-300",
    "Tier 2": "bg-orange-500/15 text-orange-300",
    "Tier 1": "bg-amber-500/15 text-amber-300",
    "None": "bg-white/5 text-white/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[tier] ?? styles.None}`}>
      {tier}
    </span>
  );
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? "bg-red-400" : pct > 40 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-white/50">{value.toFixed(1)}</span>
    </div>
  );
}

function DetailItem({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">{label}</div>
      <div className="font-semibold text-white/70">{value}</div>
      <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}

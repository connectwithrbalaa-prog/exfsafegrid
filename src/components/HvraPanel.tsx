import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, GraduationCap, HeartPulse, Trees, Droplets, Landmark, Home, Zap,
  ChevronDown, ChevronUp, MapPin,
} from "lucide-react";
import { haversineKm, getRisk, type RiskLevel, type FirePoint, RISK_COLORS } from "@/lib/wildfire-utils";

/* ── Types ──────────────────────────────────────────────────── */

export interface HvraAsset {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  latitude: number;
  longitude: number;
  importance_weight: number;
  response_function: string;
  value_estimate: number;
  population_served: number;
  notes: string | null;
}

interface HvraPanelProps {
  fires: FirePoint[];
}

/* ── Category config ─────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; mapColor: string }> = {
  Substation: { icon: Zap, color: "text-blue-400", mapColor: "#3B82F6" },
  Hospital: { icon: HeartPulse, color: "text-rose-400", mapColor: "#FB7185" },
  School: { icon: GraduationCap, color: "text-amber-400", mapColor: "#FBBF24" },
  Timber: { icon: Trees, color: "text-green-400", mapColor: "#4ADE80" },
  Water: { icon: Droplets, color: "text-cyan-400", mapColor: "#22D3EE" },
  Cultural: { icon: Landmark, color: "text-purple-400", mapColor: "#A78BFA" },
  Residential: { icon: Home, color: "text-orange-400", mapColor: "#FB923C" },
};

const RESPONSE_LABELS: Record<string, { label: string; style: string }> = {
  susceptible: { label: "Susceptible", style: "bg-red-500/15 text-red-300" },
  adaptable: { label: "Adaptable", style: "bg-amber-500/15 text-amber-300" },
  resistant: { label: "Resistant", style: "bg-emerald-500/15 text-emerald-300" },
};

/* ── Enriched asset with fire proximity ──────────────────────── */

interface EnrichedHvra extends HvraAsset {
  nearestFireKm: number;
  nearestFireMi: number;
  fireRisk: RiskLevel;
  nvcScore: number; // simplified Net Value Change proxy
}

function enrichAssets(assets: HvraAsset[], fires: FirePoint[]): EnrichedHvra[] {
  return assets.map((a) => {
    let nearest = Infinity;
    let bestFrp = 0;
    for (const f of fires) {
      const d = haversineKm(a.latitude, a.longitude, f.latitude, f.longitude);
      if (d < nearest) { nearest = d; bestFrp = f.frp; }
    }
    const fireRisk = nearest < Infinity ? getRisk(nearest, bestFrp) : "Low";
    // Simplified NVC = weight × (1/distance) × response_penalty
    const respPenalty = a.response_function === "susceptible" ? 1.0 : a.response_function === "adaptable" ? 0.6 : 0.3;
    const distFactor = nearest > 0 && nearest < Infinity ? 1 / nearest : 0;
    const nvcScore = Math.round(a.importance_weight * distFactor * respPenalty * 100) / 100;
    return {
      ...a,
      nearestFireKm: nearest < Infinity ? nearest : -1,
      nearestFireMi: nearest < Infinity ? Math.round(nearest * 0.621371) : -1,
      fireRisk,
      nvcScore,
    };
  }).sort((a, b) => b.nvcScore - a.nvcScore);
}

/* ── Component ────────────────────────────────────────────────── */

export default function HvraPanel({ fires }: HvraPanelProps) {
  const [assets, setAssets] = useState<HvraAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("All");
  const [sortField, setSortField] = useState<"nvcScore" | "importance_weight" | "nearestFireKm">("nvcScore");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("hvra_assets").select("*");
      if (!error && data) setAssets(data as unknown as HvraAsset[]);
      setLoading(false);
    })();
  }, []);

  const enriched = useMemo(() => enrichAssets(assets, fires), [assets, fires]);

  const filtered = useMemo(() => {
    let list = filterCat === "All" ? enriched : enriched.filter((a) => a.category === filterCat);
    list = [...list].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [enriched, filterCat, sortField, sortAsc]);

  const categories = useMemo(() => {
    const cats = new Set(assets.map((a) => a.category));
    return ["All", ...Array.from(cats).sort()];
  }, [assets]);

  const summary = useMemo(() => {
    const critical = enriched.filter((a) => a.fireRisk === "Critical" || a.fireRisk === "High").length;
    const totalPop = enriched.reduce((s, a) => s + a.population_served, 0);
    const avgWeight = enriched.length ? (enriched.reduce((s, a) => s + a.importance_weight, 0) / enriched.length).toFixed(1) : "0";
    return { total: enriched.length, critical, totalPop, avgWeight };
  }, [enriched]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-8 text-center text-white/30 text-sm">
        Loading HVRA Registry…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniCard label="Total HVRAs" value={String(summary.total)} />
        <MiniCard label="At High/Critical Risk" value={String(summary.critical)} highlight={summary.critical > 0} />
        <MiniCard label="Population Served" value={summary.totalPop.toLocaleString()} />
        <MiniCard label="Avg Importance" value={summary.avgWeight} />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg?.icon;
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                filterCat === cat
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-400" />
            HVRA Asset Registry
          </h2>
          <span className="text-[10px] text-white/30">{filtered.length} assets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                <th className="px-5 py-3 font-medium">Asset</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("importance_weight")}>
                  Weight <SortIcon field="importance_weight" />
                </th>
                <th className="px-5 py-3 font-medium">Response Fn</th>
                <th className="px-5 py-3 font-medium">Population</th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("nearestFireKm")}>
                  Nearest Fire <SortIcon field="nearestFireKm" />
                </th>
                <th className="px-5 py-3 font-medium">Fire Risk</th>
                <th className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("nvcScore")}>
                  NVC Score <SortIcon field="nvcScore" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((a) => {
                const cfg = CATEGORY_CONFIG[a.category] || CATEGORY_CONFIG.Residential;
                const Icon = cfg.icon;
                const resp = RESPONSE_LABELS[a.response_function] || RESPONSE_LABELS.susceptible;
                return (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{a.name}</div>
                      {a.subcategory && <div className="text-[10px] text-white/30">{a.subcategory}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{a.category}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <ImportanceBar weight={a.importance_weight} />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${resp.style}`}>
                        {resp.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white/60 text-xs tabular-nums">
                      {a.population_served > 0 ? a.population_served.toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/60 text-xs tabular-nums">
                      {a.nearestFireMi >= 0 ? `${a.nearestFireMi} mi` : "No fires"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${RISK_COLORS[a.fireRisk]}20`,
                          color: RISK_COLORS[a.fireRisk],
                        }}
                      >
                        {a.fireRisk}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs font-bold" style={{ color: a.nvcScore > 1 ? "#f87171" : a.nvcScore > 0.3 ? "#fbbf24" : "#94a3b8" }}>
                      {a.nvcScore.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-white/[0.04] text-[10px] text-white/20">
          NVC Score = Importance × (1 / Distance) × Response Penalty · Higher = greater potential loss from fire
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function MiniCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-red-500/30 bg-red-500/5" : "border-white/[0.08] bg-[hsl(220,25%,9%)]"}`}>
      <span className="text-[10px] text-white/40 uppercase tracking-wider block">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${highlight ? "text-red-400" : "text-white/90"}`}>{value}</span>
    </div>
  );
}

function ImportanceBar({ weight }: { weight: number }) {
  const pct = (weight / 10) * 100;
  const color = weight >= 8 ? "#f87171" : weight >= 6 ? "#fbbf24" : "#4ade80";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono text-white/60">{weight}</span>
    </div>
  );
}

export { CATEGORY_CONFIG };

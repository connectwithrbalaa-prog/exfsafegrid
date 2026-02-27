/**
 * AssetStrategyView — /planning/assets
 * Filterable asset risk table + investment what-if slider card.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import TopNav from "@/components/TopNav";
import DemoBadge from "@/components/DemoBadge";
import { downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import {
  BarChart3, Download, Filter, Loader2, Zap, Shield,
  Users, Building2, TrendingDown, DollarSign, SlidersHorizontal,
} from "lucide-react";

interface Asset {
  circuit_id: string;
  region: string;
  asset_type: string;
  county: string;
  voltage_kv: number;
  customer_count: number;
  critical_facilities: number;
  risk_score: number;
  risk_band: string;
  priority_rank: number;
}

interface Estimate {
  investment_pct: number;
  total_risk_reduction_pct: number;
  customers_protected: number;
  miles_hardened: number;
  cost_estimate_millions: number;
  results: {
    circuit_id: string;
    current_risk: number;
    projected_risk: number;
    current_band: string;
    projected_band: string;
    reduction_pct: number;
  }[];
  demo?: boolean;
}

const REGIONS = ["", "North Coast", "North Valley/Sierra", "Bay Area", "Central Coast", "Central Valley"];
const BANDS = ["", "CRITICAL", "HIGH", "MODERATE", "LOW"];
const TYPES = ["", "Distribution", "Transmission", "Substation"];

const BAND_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-300",
  HIGH: "bg-orange-500/15 text-orange-300",
  MODERATE: "bg-amber-500/15 text-amber-300",
  LOW: "bg-emerald-500/15 text-emerald-300",
};

export default function AssetStrategyView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [regionFilter, setRegionFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // What-if state
  const [investPct, setInvestPct] = useState(30);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assets-risk-list");

      if (error) throw error;

      let results = data?.assets ?? [];
      // Client-side filtering (edge function also filters but we re-filter for instant UX)
      if (regionFilter) results = results.filter((a: Asset) => a.region === regionFilter);
      if (bandFilter) results = results.filter((a: Asset) => a.risk_band === bandFilter);
      if (typeFilter) results = results.filter((a: Asset) => a.asset_type === typeFilter);

      setAssets(results);
      setIsDemo(data?.demo ?? false);
    } catch (e: any) {
      toast.error("Failed to load assets");
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAssets(); }, [regionFilter, bandFilter, typeFilter]);

  const runEstimate = async () => {
    const ids = selectedCircuits.length ? selectedCircuits : assets.slice(0, 5).map((a) => a.circuit_id);
    if (!ids.length) { toast.error("No circuits to analyze"); return; }
    setEstimating(true);
    try {
      const { data, error } = await supabase.functions.invoke("planning-estimate", {
        body: { circuit_ids: ids, investment_pct: investPct },
      });
      if (error) throw error;
      setEstimate(data);
    } catch (e: any) {
      toast.error("Estimate failed: " + e.message);
    }
    setEstimating(false);
  };

  const toggleCircuit = (id: string) =>
    setSelectedCircuits((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const exportCsv = () => {
    const rows = assets.map((a) => ({
      Rank: a.priority_rank,
      Circuit: a.circuit_id,
      Region: a.region,
      Type: a.asset_type,
      County: a.county,
      "Voltage (kV)": a.voltage_kv,
      Customers: a.customer_count,
      Critical: a.critical_facilities,
      "Risk Score": `${(a.risk_score * 100).toFixed(1)}%`,
      "Risk Band": a.risk_band,
    }));
    downloadCsv(rows, "asset-risk-list.csv");
  };

  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)] text-white">
      <TopNav variant="dark" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-600/20 border border-orange-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              Asset Strategy View
              {isDemo && <DemoBadge />}
            </h1>
            <p className="text-xs text-white/40">Circuit & asset risk prioritization</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-white/30" />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            <option value="">All Regions</option>
            {REGIONS.filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={bandFilter}
            onChange={(e) => setBandFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            <option value="">All Risk Bands</option>
            {BANDS.filter(Boolean).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            <option value="">All Types</option>
            {TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <span className="text-[10px] text-white/25 ml-auto">{assets.length} assets</span>
          {assets.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          )}
        </div>

        {/* Asset Table */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading assets…
            </div>
          ) : assets.length === 0 ? (
            <div className="py-16 text-center text-white/30">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No assets match current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                    <th className="px-3 py-2.5 w-8">#</th>
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={selectedCircuits.length === assets.length && assets.length > 0}
                        onChange={() =>
                          setSelectedCircuits(
                            selectedCircuits.length === assets.length ? [] : assets.map((a) => a.circuit_id)
                          )
                        }
                        className="rounded border-white/20"
                      />
                    </th>
                    <th className="px-3 py-2.5">Circuit</th>
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">County</th>
                    <th className="px-3 py-2.5 text-right">Customers</th>
                    <th className="px-3 py-2.5 text-right">Critical</th>
                    <th className="px-3 py-2.5 text-right">Risk Score</th>
                    <th className="px-3 py-2.5">Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {assets.map((a) => (
                    <tr
                      key={a.circuit_id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        a.risk_band === "CRITICAL" ? "bg-red-500/[0.04]" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-white/30 font-mono">{a.priority_rank}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedCircuits.includes(a.circuit_id)}
                          onChange={() => toggleCircuit(a.circuit_id)}
                          className="rounded border-white/20"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono font-medium text-white/90">{a.circuit_id}</td>
                      <td className="px-3 py-2.5 text-white/60">{a.region}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/50">
                          {a.asset_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/50">{a.county}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/70">{a.customer_count.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/70">{a.critical_facilities}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/90">{(a.risk_score * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${BAND_STYLE[a.risk_band] ?? BAND_STYLE.LOW}`}>
                          {a.risk_band}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Investment What-If Card */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">Investment What-If</h3>
            <span className="text-[10px] text-white/25 ml-auto">
              {selectedCircuits.length ? `${selectedCircuits.length} selected` : "Top 5 by risk"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-[10px] text-white/40 uppercase tracking-wider whitespace-nowrap">
              Hardening Investment
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={investPct}
              onChange={(e) => setInvestPct(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-sm font-bold text-blue-300 w-12 text-right">{investPct}%</span>
          </div>

          <button
            onClick={runEstimate}
            disabled={estimating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors disabled:opacity-40"
          >
            {estimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingDown className="w-3.5 h-3.5" />}
            Run Estimate
          </button>

          {estimate && (
            <div className="space-y-3 pt-2">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <WhatIfKpi icon={TrendingDown} label="Risk Reduction" value={`${estimate.total_risk_reduction_pct}%`} color="text-emerald-400" />
                <WhatIfKpi icon={Users} label="Customers Protected" value={estimate.customers_protected.toLocaleString()} color="text-blue-400" />
                <WhatIfKpi icon={Zap} label="Miles Hardened" value={String(estimate.miles_hardened)} color="text-amber-400" />
                <WhatIfKpi icon={DollarSign} label="Est. Cost" value={`$${estimate.cost_estimate_millions}M`} color="text-orange-400" />
              </div>

              {/* Per-circuit results */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                      <th className="px-3 py-2">Circuit</th>
                      <th className="px-3 py-2 text-right">Current</th>
                      <th className="px-3 py-2 text-right">Projected</th>
                      <th className="px-3 py-2 text-right">Reduction</th>
                      <th className="px-3 py-2">Band Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {estimate.results.map((r) => (
                      <tr key={r.circuit_id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono">{r.circuit_id}</td>
                        <td className="px-3 py-2 text-right font-mono">{(r.current_risk * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-300">{(r.projected_risk * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-400">-{r.reduction_pct}%</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BAND_STYLE[r.current_band]}`}>
                            {r.current_band}
                          </span>
                          <span className="text-white/20 mx-1">→</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BAND_STYLE[r.projected_band]}`}>
                            {r.projected_band}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatIfKpi({ icon: Icon, label, value, color }: {
  icon: typeof Zap; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-white/90">{value}</p>
    </div>
  );
}

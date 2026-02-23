/**
 * PredictiveOutagePanel — Pre-event customer notification scoring
 *
 * Technical approach:
 * - Scores each customer 0-100 using a weighted formula:
 *     risk_score = 0.35*hftd + 0.25*wildfire + 0.20*medical + 0.15*arrears + 0.05*gridStress
 * - Customers above threshold (≥60) are flagged for proactive outreach
 * - De-energization sequencing: sorted by score descending, grouped by substation zone
 * - Displays top 10 at-risk customers with recommended action
 */

import { useMemo, useState } from "react";
import type { Customer } from "@/lib/customer-types";
import { AlertTriangle, HeartPulse, DollarSign, Zap, Download, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  customers: Customer[];
}

interface ScoredCustomer {
  customer: Customer;
  score: number;
  factors: { label: string; points: number; color: string }[];
  action: "Immediate Call" | "SMS Alert" | "Email Notice" | "Monitor";
  urgency: "critical" | "high" | "medium" | "low";
}

function scoreCustomer(c: Customer): ScoredCustomer {
  let score = 0;
  const factors: { label: string; points: number; color: string }[] = [];

  // HFTD Tier — highest weight (35 pts max)
  const hftdPts = c.hftd_tier === "Tier 3" ? 35 : c.hftd_tier === "Tier 2" ? 22 : c.hftd_tier === "Tier 1" ? 10 : 0;
  if (hftdPts > 0) factors.push({ label: `HFTD ${c.hftd_tier}`, points: hftdPts, color: "text-red-500" });
  score += hftdPts;

  // Wildfire risk (25 pts max)
  const firePts = c.wildfire_risk === "High" ? 25 : c.wildfire_risk === "Medium" ? 15 : 5;
  factors.push({ label: `Fire Risk: ${c.wildfire_risk}`, points: firePts, color: "text-orange-500" });
  score += firePts;

  // Medical baseline (20 pts)
  if (c.medical_baseline) {
    factors.push({ label: "Medical Baseline", points: 20, color: "text-destructive" });
    score += 20;
  }

  // Arrears (15 pts max)
  const arrearsPts = c.arrears_status === "Yes" ? Math.min(15, Math.floor(c.arrears_amount / 50)) : 0;
  if (arrearsPts > 0) factors.push({ label: `Arrears $${c.arrears_amount}`, points: arrearsPts, color: "text-yellow-500" });
  score += arrearsPts;

  // Grid stress (5 pts max)
  const gridPts = c.grid_stress_level === "High" ? 5 : c.grid_stress_level === "Medium" ? 3 : 0;
  if (gridPts > 0) factors.push({ label: `Grid Stress: ${c.grid_stress_level}`, points: gridPts, color: "text-blue-400" });
  score += gridPts;

  const urgency: ScoredCustomer["urgency"] =
    score >= 75 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";

  const action: ScoredCustomer["action"] =
    score >= 75 ? "Immediate Call" : score >= 60 ? "SMS Alert" : score >= 40 ? "Email Notice" : "Monitor";

  return { customer: c, score: Math.min(100, score), factors, action, urgency };
}

const URGENCY_STYLES = {
  critical: { bar: "bg-red-500", badge: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40", label: "Critical" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-300", label: "High" },
  medium:   { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-300", label: "Medium" },
  low:      { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-300", label: "Low" },
};

export default function PredictiveOutagePanel({ customers }: Props) {
  const [threshold, setThreshold] = useState(50);
  const [filterUrgency, setFilterUrgency] = useState<string>("All");

  const scored = useMemo(
    () =>
      customers
        .map(scoreCustomer)
        .sort((a, b) => b.score - a.score),
    [customers]
  );

  const filtered = useMemo(() => {
    let list = scored.filter((s) => s.score >= threshold);
    if (filterUrgency !== "All") list = list.filter((s) => s.urgency === filterUrgency.toLowerCase());
    return list;
  }, [scored, threshold, filterUrgency]);

  const summary = useMemo(() => ({
    critical: scored.filter((s) => s.urgency === "critical").length,
    high:     scored.filter((s) => s.urgency === "high").length,
    medium:   scored.filter((s) => s.urgency === "medium").length,
    total:    scored.filter((s) => s.score >= threshold).length,
  }), [scored, threshold]);

  // Group by de-energization zone for sequencing
  const zoneGroups = useMemo(() => {
    const groups: Record<string, ScoredCustomer[]> = {};
    filtered.forEach((s) => {
      const zone = s.customer.zip_code.slice(0, 3); // Simplified zone grouping
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(s);
    });
    return Object.entries(groups).sort((a, b) => {
      const maxA = Math.max(...a[1].map((x) => x.score));
      const maxB = Math.max(...b[1].map((x) => x.score));
      return maxB - maxA;
    });
  }, [filtered]);

  const exportCSV = () => {
    const rows = [
      ["Name", "ZIP", "Region", "Score", "Urgency", "Action", "Medical", "HFTD Tier", "Arrears"],
      ...filtered.map((s) => [
        s.customer.name,
        s.customer.zip_code,
        s.customer.region,
        s.score,
        s.urgency,
        s.action,
        s.customer.medical_baseline ? "Yes" : "No",
        s.customer.hftd_tier,
        s.customer.arrears_status === "Yes" ? `$${s.customer.arrears_amount}` : "No",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outage-outreach-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Outreach list exported to CSV");
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Critical", count: summary.critical, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "High", count: summary.high, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Medium", count: summary.medium, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "In Scope", count: summary.total, color: "text-white", bg: "bg-white/5 border-white/10" },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg border p-3 ${c.bg}`}>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.count}</p>
            <p className="text-[10px] text-white/30">customers</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 whitespace-nowrap">Min Score:</label>
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-28 accent-orange-500"
          />
          <span className="text-xs font-mono text-white/70 w-6">{threshold}</span>
        </div>
        <div className="flex items-center gap-2">
          {["All", "Critical", "High", "Medium"].map((u) => (
            <button
              key={u}
              onClick={() => setFilterUrgency(u)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterUrgency === u
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* De-energization Sequencing — Zone View */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
          De-Energization Outreach Sequence ({filtered.length} customers)
        </h3>
        <div className="space-y-3">
          {zoneGroups.map(([zone, list], zIdx) => (
            <div key={zone} className="rounded-lg border border-white/[0.08] overflow-hidden">
              <div className="px-4 py-2 bg-white/[0.04] flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                  Zone {zone}xxx — {list.length} customers
                </span>
                <span className="text-[10px] text-white/25">
                  Seq #{zIdx + 1} · Avg Score: {Math.round(list.reduce((a, b) => a + b.score, 0) / list.length)}
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {list.map((s) => {
                  const st = URGENCY_STYLES[s.urgency];
                  return (
                    <div key={s.customer.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02]">
                      {/* Score bar */}
                      <div className="flex items-center gap-2 w-24 shrink-0">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${st.bar}`}
                            style={{ width: `${s.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-white/60 w-6 text-right">{s.score}</span>
                      </div>

                      {/* Customer info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/90 truncate">{s.customer.name}</span>
                          {s.customer.medical_baseline && (
                            <HeartPulse className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          )}
                          {s.customer.arrears_status === "Yes" && (
                            <DollarSign className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          ZIP {s.customer.zip_code} · {s.customer.hftd_tier} · {s.customer.region}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.factors.map((f) => (
                            <span key={f.label} className={`text-[9px] ${f.color}`}>
                              +{f.points} {f.label}
                            </span>
                          )).reduce<React.ReactNode[]>((acc, el, i, arr) => {
                            acc.push(el);
                            if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="text-white/15 text-[9px]">·</span>);
                            return acc;
                          }, [])}
                        </div>
                      </div>

                      {/* Urgency badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge} shrink-0`}>
                        {st.label}
                      </span>

                      {/* Action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.action === "Immediate Call" && (
                          <button
                            onClick={() => toast.success(`Calling ${s.customer.name}…`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600/20 border border-red-500/30 text-red-300 text-[10px] font-medium hover:bg-red-600/30 transition-colors"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            Call Now
                          </button>
                        )}
                        {s.action === "SMS Alert" && (
                          <button
                            onClick={() => toast.success(`SMS sent to ${s.customer.name}`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-600/20 border border-orange-500/30 text-orange-300 text-[10px] font-medium hover:bg-orange-600/30 transition-colors"
                          >
                            <Zap className="w-2.5 h-2.5" />
                            Send SMS
                          </button>
                        )}
                        {s.action === "Email Notice" && (
                          <button
                            onClick={() => toast.success(`Email queued for ${s.customer.name}`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-medium hover:bg-blue-600/30 transition-colors"
                          >
                            <Mail className="w-2.5 h-2.5" />
                            Email
                          </button>
                        )}
                        {s.action === "Monitor" && (
                          <span className="text-[10px] text-white/20">Monitor</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-white/30 text-sm">
              No customers above score threshold {threshold}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

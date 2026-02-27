/**
 * PredictiveOutagePanel — Live risk data + Pre-event customer notification scoring
 */

import { useMemo, useState } from "react";
import type { Customer } from "@/lib/customer-types";
import { useIgnitionRisk, usePsaRisk } from "@/hooks/use-api";
import { AlertTriangle, HeartPulse, DollarSign, Zap, Download, Phone, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import RiskBadge from "@/components/RiskBadge";

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

  const hftdPts = c.hftd_tier === "Tier 3" ? 35 : c.hftd_tier === "Tier 2" ? 22 : c.hftd_tier === "Tier 1" ? 10 : 0;
  if (hftdPts > 0) factors.push({ label: `HFTD ${c.hftd_tier}`, points: hftdPts, color: "text-destructive" });
  score += hftdPts;

  const firePts = c.wildfire_risk === "High" ? 25 : c.wildfire_risk === "Medium" ? 15 : 5;
  factors.push({ label: `Fire Risk: ${c.wildfire_risk}`, points: firePts, color: "text-warning" });
  score += firePts;

  if (c.medical_baseline) {
    factors.push({ label: "Medical Baseline", points: 20, color: "text-destructive" });
    score += 20;
  }

  const arrearsPts = c.arrears_status === "Yes" ? Math.min(15, Math.floor(c.arrears_amount / 50)) : 0;
  if (arrearsPts > 0) factors.push({ label: `Arrears $${c.arrears_amount}`, points: arrearsPts, color: "text-warning" });
  score += arrearsPts;

  const gridPts = c.grid_stress_level === "High" ? 5 : c.grid_stress_level === "Medium" ? 3 : 0;
  if (gridPts > 0) factors.push({ label: `Grid Stress: ${c.grid_stress_level}`, points: gridPts, color: "text-info" });
  score += gridPts;

  const urgency: ScoredCustomer["urgency"] =
    score >= 75 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";

  const action: ScoredCustomer["action"] =
    score >= 75 ? "Immediate Call" : score >= 60 ? "SMS Alert" : score >= 40 ? "Email Notice" : "Monitor";

  return { customer: c, score: Math.min(100, score), factors, action, urgency };
}

const URGENCY_STYLES = {
  critical: { bar: "bg-destructive", badge: "bg-destructive/15 text-destructive border border-destructive/30", label: "Critical" },
  high:     { bar: "bg-warning", badge: "bg-warning/15 text-warning", label: "High" },
  medium:   { bar: "bg-warning/70", badge: "bg-warning/10 text-warning/80", label: "Medium" },
  low:      { bar: "bg-success", badge: "bg-success/15 text-success", label: "Low" },
};

/* ── Live Risk Mini-Tables ─────────────────────────────────── */

function LiveRiskSection() {
  const { data: ignition, isLoading: igLoading, isError: igError } = useIgnitionRisk({ horizon_hours: 24 });
  const { data: psaRisk, isLoading: psaLoading, isError: psaError } = usePsaRisk({ month_offset: 1 });

  const topIgnition = useMemo(() => {
    return [...(ignition?.results ?? [])]
      .sort((a, b) => b.prob_spike - a.prob_spike)
      .slice(0, 5);
  }, [ignition]);

  const topPsa = useMemo(() => {
    return [...(psaRisk?.results ?? [])]
      .sort((a, b) => b.prob_above_normal - a.prob_above_normal)
      .slice(0, 5);
  }, [psaRisk]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Ignition Spike — Top 5 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-destructive/5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-destructive" />
            Top 5 Ignition Spike Risk (24h)
          </h3>
        </div>
        {igLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : igError ? (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed to load ignition risk
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Circuit</th>
                <th className="px-3 py-2 font-medium">PSA</th>
                <th className="px-3 py-2 font-medium">Prob</th>
                <th className="px-3 py-2 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {topIgnition.map((r) => (
                <tr key={r.circuit_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-card-foreground">{r.circuit_id}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.psa_id}</td>
                  <td className="px-3 py-2 font-mono text-card-foreground">{(r.prob_spike * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2"><RiskBadge level={r.risk_band} /></td>
                </tr>
              ))}
              {topIgnition.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PSA Risk — Top 5 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-warning/5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            Top 5 PSA Risk (Month 1)
          </h3>
        </div>
        {psaLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : psaError ? (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed to load PSA risk
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Circuit</th>
                <th className="px-3 py-2 font-medium">PSA</th>
                <th className="px-3 py-2 font-medium">Prob</th>
                <th className="px-3 py-2 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {topPsa.map((r) => (
                <tr key={r.circuit_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-card-foreground">{r.circuit_id}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.psa_id}</td>
                  <td className="px-3 py-2 font-mono text-card-foreground">{(r.prob_above_normal * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2"><RiskBadge level={r.risk_bucket} /></td>
                </tr>
              ))}
              {topPsa.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function PredictiveOutagePanel({ customers }: Props) {
  const [threshold, setThreshold] = useState(50);
  const [filterUrgency, setFilterUrgency] = useState<string>("All");

  const scored = useMemo(
    () => customers.map(scoreCustomer).sort((a, b) => b.score - a.score),
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

  const zoneGroups = useMemo(() => {
    const groups: Record<string, ScoredCustomer[]> = {};
    filtered.forEach((s) => {
      const zone = s.customer.zip_code.slice(0, 3);
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
        s.customer.name, s.customer.zip_code, s.customer.region, s.score, s.urgency, s.action,
        s.customer.medical_baseline ? "Yes" : "No", s.customer.hftd_tier,
        s.customer.arrears_status === "Yes" ? `$${s.customer.arrears_amount}` : "No",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `outage-outreach-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Outreach list exported to CSV");
  };

  return (
    <div className="space-y-4">
      {/* ── Live Risk Tables (from FastAPI) ─────────────────── */}
      <LiveRiskSection />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Critical", count: summary.critical, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
          { label: "High", count: summary.high, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
          { label: "Medium", count: summary.medium, color: "text-warning/80", bg: "bg-warning/5 border-warning/15" },
          { label: "In Scope", count: summary.total, color: "text-foreground", bg: "bg-muted/50 border-border" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-3.5 ${c.bg}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.count}</p>
            <p className="text-[10px] text-muted-foreground/60">customers</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap p-3 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Min Score:</label>
          <input
            type="range" min={0} max={100} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-28 accent-primary"
          />
          <span className="text-xs font-mono text-foreground/70 w-6">{threshold}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {["All", "Critical", "High", "Medium"].map((u) => (
            <button
              key={u} onClick={() => setFilterUrgency(u)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterUrgency === u
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-medium hover:bg-success/20 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* De-energization Sequencing — Zone View */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          De-Energization Outreach Sequence ({filtered.length} customers)
        </h3>
        <div className="space-y-3">
          {zoneGroups.map(([zone, list], zIdx) => (
            <div key={zone} className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="px-4 py-2.5 bg-muted/40 flex items-center gap-3 border-b border-border/60">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Zone {zone}xxx — {list.length} customers
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  Seq #{zIdx + 1} · Avg Score: {Math.round(list.reduce((a, b) => a + b.score, 0) / list.length)}
                </span>
              </div>
              <div className="divide-y divide-border/40">
                {list.map((s) => {
                  const st = URGENCY_STYLES[s.urgency];
                  return (
                    <div key={s.customer.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-20 shrink-0">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${s.score}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{s.score}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${st.badge} shrink-0 sm:hidden`}>
                            {st.label}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-card-foreground truncate">{s.customer.name}</span>
                            {s.customer.medical_baseline && <HeartPulse className="w-3.5 h-3.5 text-destructive shrink-0" />}
                            {s.customer.arrears_status === "Yes" && <DollarSign className="w-3.5 h-3.5 text-warning shrink-0" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            ZIP {s.customer.zip_code} · {s.customer.hftd_tier} · {s.customer.region}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.factors.map((f) => (
                              <span key={f.label} className={`text-[9px] ${f.color}`}>+{f.points} {f.label}</span>
                            )).reduce<React.ReactNode[]>((acc, el, i, arr) => {
                              acc.push(el);
                              if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="text-muted-foreground/30 text-[9px]">·</span>);
                              return acc;
                            }, [])}
                          </div>
                        </div>

                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${st.badge} shrink-0 hidden sm:inline`}>
                          {st.label}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.action === "Immediate Call" && (
                            <button onClick={() => toast.success(`Calling ${s.customer.name}…`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors">
                              <Phone className="w-2.5 h-2.5" /> Call Now
                            </button>
                          )}
                          {s.action === "SMS Alert" && (
                            <button onClick={() => toast.success(`SMS sent to ${s.customer.name}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-[10px] font-medium hover:bg-warning/20 transition-colors">
                              <Zap className="w-2.5 h-2.5" /> Send SMS
                            </button>
                          )}
                          {s.action === "Email Notice" && (
                            <button onClick={() => toast.success(`Email queued for ${s.customer.name}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors">
                              <Mail className="w-2.5 h-2.5" /> Email
                            </button>
                          )}
                          {s.action === "Monitor" && (
                            <span className="text-[10px] text-muted-foreground/50">Monitor</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm rounded-xl border border-dashed border-border">
              No customers above score threshold {threshold}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

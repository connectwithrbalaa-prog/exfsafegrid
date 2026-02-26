/**
 * HardshipTriagePanel — Customer Financial Hardship Triage
 */

import { useMemo, useState, useCallback } from "react";
import type { Customer } from "@/lib/customer-types";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, HeartPulse, AlertTriangle,
  CheckCircle2, Download, Filter, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  customers: Customer[];
  onCustomerUpdate?: (updated: Customer) => void;
}

interface TriagedCustomer {
  customer: Customer;
  score: number;
  breakdown: { label: string; pts: number }[];
  tier: "Critical" | "High" | "Medium" | "Low";
  recommendedAction: string;
}

function triageCustomer(c: Customer): TriagedCustomer {
  const breakdown: { label: string; pts: number }[] = [];
  let score = 0;

  if (c.arrears_status === "Yes") {
    const pts = Math.min(40, Math.floor(c.arrears_amount / 12.5));
    breakdown.push({ label: `Arrears $${c.arrears_amount.toFixed(0)}`, pts });
    score += pts;
  }

  const outages = c.outage_history ? c.outage_history.split(",").filter(Boolean).length : 0;
  if (outages > 0) {
    const pts = Math.min(25, outages * 5);
    breakdown.push({ label: `${outages} past outage${outages > 1 ? "s" : ""}`, pts });
    score += pts;
  }

  const billPts = c.bill_trend === "Rising" ? 20 : c.bill_trend === "Stable" ? 10 : 0;
  if (billPts > 0) {
    breakdown.push({ label: `Bill ${c.bill_trend}`, pts: billPts });
    score += billPts;
  }

  if (c.medical_baseline) {
    breakdown.push({ label: "Medical Baseline", pts: 15 });
    score += 15;
  }

  const capped = Math.min(100, score);
  const tier: TriagedCustomer["tier"] =
    capped >= 75 ? "Critical" : capped >= 55 ? "High" : capped >= 35 ? "Medium" : "Low";

  const recommendedAction =
    tier === "Critical" ? "Immediate REACH + Payment Plan"
    : tier === "High" ? "Offer REACH Enrollment"
    : tier === "Medium" ? "Send Assistance Info"
    : "Monitor";

  return { customer: c, score: capped, breakdown, tier, recommendedAction };
}

const TIER_CONFIG = {
  Critical: { badge: "bg-destructive/15 text-destructive border border-destructive/30", bar: "bg-destructive" },
  High:     { badge: "bg-warning/15 text-warning", bar: "bg-warning" },
  Medium:   { badge: "bg-warning/10 text-warning/80", bar: "bg-warning/70" },
  Low:      { badge: "bg-success/15 text-success", bar: "bg-success" },
};

export default function HardshipTriagePanel({ customers, onCustomerUpdate }: Props) {
  const [threshold, setThreshold] = useState(35);
  const [filterTier, setFilterTier] = useState<string>("All");
  const [applying, setApplying] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const triaged = useMemo(
    () => customers.map(triageCustomer).sort((a, b) => b.score - a.score),
    [customers]
  );

  const filtered = useMemo(() => {
    let list = triaged.filter((t) => t.score >= threshold);
    if (filterTier !== "All") list = list.filter((t) => t.tier === filterTier);
    return list;
  }, [triaged, threshold, filterTier]);

  const stats = useMemo(() => ({
    critical: triaged.filter((t) => t.tier === "Critical").length,
    high:     triaged.filter((t) => t.tier === "High").length,
    totalExposure: triaged.reduce((sum, t) => sum + (t.customer.arrears_amount || 0), 0),
  }), [triaged]);

  const applyReach = useCallback(async (t: TriagedCustomer) => {
    const c = t.customer;
    setApplying((prev) => new Set(prev).add(c.id));
    const newAmount = Math.round(c.arrears_amount * 0.5 * 100) / 100;
    const { error } = await supabase
      .from("customers")
      .update({ arrears_amount: newAmount } as any)
      .eq("id", c.id as any);
    setApplying((prev) => { const s = new Set(prev); s.delete(c.id); return s; });
    if (error) {
      toast.error(`Failed to apply REACH for ${c.name}`);
    } else {
      setApplied((prev) => new Set(prev).add(c.id));
      toast.success(`REACH applied for ${c.name} — arrears reduced by 50% to $${newAmount}`);
      onCustomerUpdate?.({ ...c, arrears_amount: newAmount });
    }
  }, [onCustomerUpdate]);

  const exportCSV = () => {
    const rows = [
      ["Name", "ZIP", "Score", "Tier", "Arrears $", "Outages", "Bill Trend", "Medical", "Action"],
      ...filtered.map((t) => [
        t.customer.name, t.customer.zip_code, t.score, t.tier,
        t.customer.arrears_amount.toFixed(2),
        t.customer.outage_history ? t.customer.outage_history.split(",").filter(Boolean).length : 0,
        t.customer.bill_trend, t.customer.medical_baseline ? "Yes" : "No", t.recommendedAction,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hardship-triage-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Hardship triage list exported");
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Critical", val: stats.critical, color: "text-destructive", sub: "needs immediate action", bg: "bg-destructive/10 border-destructive/20" },
          { label: "High Risk", val: stats.high, color: "text-warning", sub: "offer REACH", bg: "bg-warning/10 border-warning/20" },
          { label: "Total Exposure", val: `$${stats.totalExposure.toLocaleString()}`, color: "text-warning/80", sub: "in arrears", bg: "bg-muted/50 border-border" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-3.5 ${s.bg}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-muted-foreground/60">{s.sub}</p>
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
            className="w-24 accent-primary"
          />
          <span className="text-xs font-mono text-foreground/70 w-6">{threshold}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {["All", "Critical", "High", "Medium"].map((tier) => (
            <button
              key={tier} onClick={() => setFilterTier(tier)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterTier === tier
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tier}
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

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">{filtered.length} customers in triage scope</span>
          <Filter className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
        <div className="divide-y divide-border/40">
          {filtered.map((t) => {
            const cfg = TIER_CONFIG[t.tier];
            const isApplying = applying.has(t.customer.id);
            const isApplied = applied.has(t.customer.id);
            return (
              <div key={t.customer.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  {/* Score + mobile tier badge */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-20 shrink-0">
                      <div className="flex-1 h-1.5 rounded-full bg-muted">
                        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${t.score}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{t.score}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.badge} shrink-0 sm:hidden`}>
                      {t.tier}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-card-foreground truncate">{t.customer.name}</span>
                      {t.customer.medical_baseline && <HeartPulse className="w-3 h-3 text-destructive shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t.customer.zip_code} · {t.customer.region}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {t.breakdown.map((b) => (
                        <span key={b.label} className="text-[9px] text-warning">+{b.pts} {b.label}</span>
                      )).reduce<React.ReactNode[]>((acc, el, i, arr) => {
                        acc.push(el);
                        if (i < arr.length - 1) acc.push(<span key={`s-${i}`} className="text-muted-foreground/30 text-[9px]">·</span>);
                        return acc;
                      }, [])}
                    </div>
                  </div>

                  {/* Desktop-only tier */}
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.badge} shrink-0 hidden sm:inline`}>
                    {t.tier}
                  </span>

                  {/* Action */}
                  <div className="shrink-0">
                    {t.customer.arrears_status === "Yes" && !isApplied ? (
                      <button
                        onClick={() => applyReach(t)}
                        disabled={isApplying}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-[10px] font-medium hover:bg-success/20 disabled:opacity-40 transition-colors"
                      >
                        {isApplying ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <DollarSign className="w-2.5 h-2.5" />}
                        Apply REACH
                      </button>
                    ) : isApplied ? (
                      <span className="flex items-center gap-1 text-[10px] text-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Applied
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">{t.recommendedAction}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No customers above hardship score {threshold}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50 px-1">
        Score formula: Arrears (40%) + Outage history (25%) + Bill trend (20%) + Medical baseline (15%).
        REACH reduces arrears by 50%. All changes sync in real-time to all agent desktops.
      </p>
    </div>
  );
}
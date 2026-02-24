/**
 * VegetationRiskPanel — Vegetation Management Risk Layer
 *
 * Technical approach:
 * - Circuit-level trim cycle compliance data (mock; production: fetched from work-order DB)
 * - Risk elevation logic: circuits with expired trim cycles AND high wildfire risk get
 *   elevated risk flag visible to agents and in Command Center map layer
 * - Compliance status: "Current" / "Due Soon" (within 90 days) / "Overdue"
 * - Sortable table with work-order initiation CTA
 * - Visual compliance heatmap strip by substation zone
 * - Integration: Add as "Vegetation" toggle layer on CommandCenter Mapbox map
 */

import { useState, useMemo } from "react";
import { Leaf, AlertTriangle, CheckCircle2, Clock, TrendingUp, Download, Filter } from "lucide-react";
import { toast } from "sonner";

interface CircuitTrimRecord {
  id: string;
  circuitName: string;
  substationZone: string;
  lastTrimDate: Date;
  nextTrimDue: Date;
  treesPerMile: number;
  milesConductor: number;
  hftdTier: "Tier 3" | "Tier 2" | "Tier 1" | "None";
  wildfireRisk: "High" | "Medium" | "Low";
  complianceStatus: "Current" | "Due Soon" | "Overdue";
  workOrderId: string | null;
  riskElevated: boolean;
}

function calcComplianceStatus(nextDue: Date): CircuitTrimRecord["complianceStatus"] {
  const now = Date.now();
  const daysUntilDue = (nextDue.getTime() - now) / 86400000;
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue < 90) return "Due Soon";
  return "Current";
}

// Mock dataset — production: pull from work-order management system via API
const MOCK_CIRCUITS: Omit<CircuitTrimRecord, "complianceStatus" | "riskElevated">[] = [
  {
    id: "c-001", circuitName: "HTD-5370-A", substationZone: "Zone 1 — Tuolumne",
    lastTrimDate: new Date("2023-03-15"), nextTrimDue: new Date("2024-03-15"),
    treesPerMile: 42, milesConductor: 18.4,
    hftdTier: "Tier 3", wildfireRisk: "High", workOrderId: null,
  },
  {
    id: "c-002", circuitName: "HTD-5321-B", substationZone: "Zone 1 — Tuolumne",
    lastTrimDate: new Date("2023-11-01"), nextTrimDue: new Date("2025-05-01"),
    treesPerMile: 28, milesConductor: 12.1,
    hftdTier: "Tier 2", wildfireRisk: "Medium", workOrderId: "WO-24-1441",
  },
  {
    id: "c-003", circuitName: "HTD-5383-C", substationZone: "Zone 2 — Calaveras",
    lastTrimDate: new Date("2024-01-20"), nextTrimDue: new Date("2025-07-20"),
    treesPerMile: 35, milesConductor: 22.7,
    hftdTier: "Tier 3", wildfireRisk: "High", workOrderId: "WO-24-1507",
  },
  {
    id: "c-004", circuitName: "HTD-5382-A", substationZone: "Zone 2 — Calaveras",
    lastTrimDate: new Date("2023-06-30"), nextTrimDue: new Date("2024-12-30"),
    treesPerMile: 19, milesConductor: 9.3,
    hftdTier: "Tier 2", wildfireRisk: "Medium", workOrderId: null,
  },
  {
    id: "c-005", circuitName: "HTD-5442-D", substationZone: "Zone 3 — Stanislaus",
    lastTrimDate: new Date("2024-04-10"), nextTrimDue: new Date("2025-10-10"),
    treesPerMile: 11, milesConductor: 8.0,
    hftdTier: "Tier 1", wildfireRisk: "Low", workOrderId: "WO-24-1608",
  },
  {
    id: "c-006", circuitName: "HTD-5338-B", substationZone: "Zone 3 — Stanislaus",
    lastTrimDate: new Date("2022-09-01"), nextTrimDue: new Date("2023-09-01"),
    treesPerMile: 53, milesConductor: 31.2,
    hftdTier: "Tier 3", wildfireRisk: "High", workOrderId: null,
  },
  {
    id: "c-007", circuitName: "HTD-5300-C", substationZone: "Zone 4 — Bay Area North",
    lastTrimDate: new Date("2024-02-15"), nextTrimDue: new Date("2025-08-15"),
    treesPerMile: 8, milesConductor: 5.4,
    hftdTier: "None", wildfireRisk: "Low", workOrderId: "WO-24-1412",
  },
];

const circuits: CircuitTrimRecord[] = MOCK_CIRCUITS.map((c) => {
  const status = calcComplianceStatus(c.nextTrimDue);
  return {
    ...c,
    complianceStatus: status,
    riskElevated: (status === "Overdue" || status === "Due Soon") && c.wildfireRisk === "High",
  };
});

const STATUS_CONFIG = {
  Current:   { badge: "bg-emerald-500/15 text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  "Due Soon": { badge: "bg-amber-500/15 text-amber-300", icon: <Clock className="w-3 h-3" /> },
  Overdue:   { badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
};

const HFTD_COLORS = {
  "Tier 3": "text-red-400", "Tier 2": "text-orange-400",
  "Tier 1": "text-amber-400", "None": "text-white/30",
};

const RISK_COLORS_TEXT = { High: "text-red-400", Medium: "text-amber-400", Low: "text-emerald-400" };

export default function VegetationRiskPanel() {
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterHftd, setFilterHftd] = useState<string>("All");
  const [sortCol, setSortCol] = useState<string>("compliance");
  const [sortDesc, setSortDesc] = useState(true);
  const [initiated, setInitiated] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = [...circuits];
    if (filterStatus !== "All") list = list.filter((c) => c.complianceStatus === filterStatus);
    if (filterHftd !== "All") list = list.filter((c) => c.hftdTier === filterHftd);

    const STATUS_RANK = { Overdue: 3, "Due Soon": 2, Current: 1 };
    const RISK_RANK = { High: 3, Medium: 2, Low: 1 };
    const HFTD_RANK = { "Tier 3": 4, "Tier 2": 3, "Tier 1": 2, "None": 1 };

    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "compliance") cmp = (STATUS_RANK[a.complianceStatus] ?? 0) - (STATUS_RANK[b.complianceStatus] ?? 0);
      else if (sortCol === "risk") cmp = (RISK_RANK[a.wildfireRisk] ?? 0) - (RISK_RANK[b.wildfireRisk] ?? 0);
      else if (sortCol === "hftd") cmp = (HFTD_RANK[a.hftdTier] ?? 0) - (HFTD_RANK[b.hftdTier] ?? 0);
      else if (sortCol === "trees") cmp = a.treesPerMile - b.treesPerMile;
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [filterStatus, filterHftd, sortCol, sortDesc]);

  const stats = useMemo(() => ({
    overdue: circuits.filter((c) => c.complianceStatus === "Overdue").length,
    dueSoon: circuits.filter((c) => c.complianceStatus === "Due Soon").length,
    elevated: circuits.filter((c) => c.riskElevated).length,
  }), []);

  const sortBy = (col: string) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
  };

  const initiateWorkOrder = (c: CircuitTrimRecord) => {
    setInitiated((prev) => new Set(prev).add(c.id));
    toast.success(`Work order initiated for ${c.circuitName} — queued in work-order system`);
  };

  const exportCSV = () => {
    const rows = [
      ["Circuit", "Zone", "Trim Status", "Last Trim", "Next Due", "Trees/Mile", "Miles", "HFTD", "Risk", "Elevated", "Work Order"],
      ...filtered.map((c) => [
        c.circuitName, c.substationZone, c.complianceStatus,
        c.lastTrimDate.toLocaleDateString(), c.nextTrimDue.toLocaleDateString(),
        c.treesPerMile, c.milesConductor, c.hftdTier, c.wildfireRisk,
        c.riskElevated ? "YES" : "No", c.workOrderId || "None",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vegetation-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Vegetation compliance report exported");
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Overdue", val: stats.overdue, color: "text-red-400", sub: "past trim date" },
          { label: "Due Soon", val: stats.dueSoon, color: "text-amber-400", sub: "within 90 days" },
          { label: "Risk Elevated", val: stats.elevated, color: "text-orange-400", sub: "overdue + High fire risk" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/20">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {["All", "Overdue", "Due Soon", "Current"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterStatus === s ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {["All", "Tier 3", "Tier 2", "Tier 1"].map((h) => (
            <button
              key={h}
              onClick={() => setFilterHftd(h)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterHftd === h ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
      </div>

      {/* Risk elevated banner */}
      {stats.elevated > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <TrendingUp className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-300">
              {stats.elevated} circuit{stats.elevated > 1 ? "s" : ""} with elevated ignition risk
            </p>
            <p className="text-[10px] text-red-400/70 mt-0.5">
              Overdue vegetation trimming combined with High wildfire risk. Initiate work orders immediately.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
              {[
                { key: "", label: "Circuit / Zone" },
                { key: "compliance", label: "Trim Status" },
                { key: "", label: "Last Trim" },
                { key: "", label: "Next Due" },
                { key: "trees", label: "Trees/Mile" },
                { key: "hftd", label: "HFTD" },
                { key: "risk", label: "Fire Risk" },
                { key: "", label: "Work Order" },
                { key: "", label: "Action" },
              ].map((h) => (
                <th
                  key={h.label}
                  className={`px-4 py-3 font-medium ${h.key ? "cursor-pointer hover:text-white/60 select-none" : ""}`}
                  onClick={h.key ? () => sortBy(h.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {h.key && sortCol === h.key && <span className="text-white/40">{sortDesc ? "▼" : "▲"}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((c) => {
              const sc = STATUS_CONFIG[c.complianceStatus];
              const isInit = initiated.has(c.id);
              return (
                <tr key={c.id} className={`hover:bg-white/[0.02] transition-colors ${c.riskElevated ? "bg-red-500/[0.04]" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.riskElevated && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                      <div>
                        <p className="font-medium text-white/90">{c.circuitName}</p>
                        <p className="text-[10px] text-white/30">{c.substationZone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>
                      {sc.icon}
                      {c.complianceStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">{c.lastTrimDate.toLocaleDateString()}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${c.complianceStatus === "Overdue" ? "text-red-400" : c.complianceStatus === "Due Soon" ? "text-amber-400" : "text-white/40"}`}>
                    {c.nextTrimDue.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60 font-mono">
                    {c.treesPerMile} <span className="text-white/20">/ {c.milesConductor}mi</span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-semibold ${HFTD_COLORS[c.hftdTier]}`}>{c.hftdTier}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${RISK_COLORS_TEXT[c.wildfireRisk]}`}>{c.wildfireRisk}</td>
                  <td className="px-4 py-3 text-xs text-white/30 font-mono">
                    {c.workOrderId || <span className="text-red-400/60">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(c.complianceStatus !== "Current" || c.riskElevated) && !c.workOrderId && !isInit ? (
                      <button
                        onClick={() => initiateWorkOrder(c)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600/20 border border-amber-500/30 text-amber-300 text-[10px] font-medium hover:bg-amber-600/30 transition-colors"
                      >
                        <Leaf className="w-2.5 h-2.5" />
                        Start WO
                      </button>
                    ) : isInit || c.workOrderId ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {isInit ? "Initiated" : "Active"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/15">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-white/20 px-1">
        Risk elevation: circuits with overdue/due-soon trim AND High wildfire risk are flagged for immediate work order initiation.
        Trim cycle standard: 12 months for HFTD Tier 3/2, 18 months for Tier 1/None.
      </p>
    </div>
  );
}

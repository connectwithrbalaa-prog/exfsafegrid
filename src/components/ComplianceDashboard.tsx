/**
 * ComplianceDashboard — Regulatory Compliance Dashboard
 *
 * Technical approach:
 * - Tracks CPUC General Order 95 and NERC CIP-014 compliance items
 * - PSPS event log table with SLA adherence tracking:
 *     - Notification timeliness (4h window for medical baseline)
 *     - Restoration timeliness (per circuit category)
 *     - CRC staffing compliance
 * - SLA breach detection and visual flagging
 * - Annual PSPS de-brief submission tracker
 * - Export CPUC-formatted event report as CSV
 */

import { useState, useMemo } from "react";
import {
  Shield, CheckCircle2, AlertTriangle, XCircle,
  Clock, Download, FileText, ChevronDown, ChevronUp,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface ComplianceItem {
  id: string;
  regulation: string;
  requirement: string;
  status: "Compliant" | "At Risk" | "Non-Compliant" | "N/A";
  lastVerified: Date;
  details: string;
  evidence: string;
}

interface PspsEventLog {
  id: string;
  eventId: string;
  date: Date;
  region: string;
  affectedCustomers: number;
  medicalBaseline: number;
  notificationTime: number; // hours before de-energization
  restorationHours: number;
  crcStaffed: boolean;
  slaBreaches: string[];
  submitted: boolean;
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  {
    id: "go95-1",
    regulation: "CPUC GO 95",
    requirement: "Medical baseline customer notification ≤ 4h before PSPS",
    status: "Compliant",
    lastVerified: new Date("2024-10-17"),
    details: "All 23 medical baseline customers notified avg 2.1 hours before de-energization",
    evidence: "SMS log PSPS-2024-001, call records attached",
  },
  {
    id: "go95-2",
    regulation: "CPUC GO 95",
    requirement: "24-hour advance PSPS customer notification",
    status: "Compliant",
    lastVerified: new Date("2024-10-17"),
    details: "Notifications dispatched 26h 15m before de-energization for all affected customers",
    evidence: "SMS broadcast log, audit trail ID-44192",
  },
  {
    id: "go95-3",
    regulation: "CPUC GO 95",
    requirement: "Community Resource Center (CRC) staffing during PSPS",
    status: "Compliant",
    lastVerified: new Date("2024-10-17"),
    details: "3 CRC locations open and staffed during full de-energization window",
    evidence: "Crew sign-in sheets, CRC activity logs",
  },
  {
    id: "go95-4",
    regulation: "CPUC GO 95",
    requirement: "PSPS post-event report filed within 10 business days",
    status: "At Risk",
    lastVerified: new Date("2024-10-22"),
    details: "Deadline: October 31, 2024. Report draft in progress. 3 sections pending sign-off.",
    evidence: "Draft report in document management system",
  },
  {
    id: "go95-5",
    regulation: "CPUC Rule 20A",
    requirement: "Outage duration reporting for >50,000 customer-hours",
    status: "Compliant",
    lastVerified: new Date("2024-10-18"),
    details: "Event affected 847 customers × 39.5h = 33,457 customer-hours. Below 50k threshold.",
    evidence: "OMS export attached",
  },
  {
    id: "nerc-1",
    regulation: "NERC CIP-014",
    requirement: "Transmission substation risk assessment (annual)",
    status: "Compliant",
    lastVerified: new Date("2024-06-30"),
    details: "Annual risk assessment completed June 2024. All 4 substations assessed.",
    evidence: "CIP-014 assessment report on file",
  },
  {
    id: "nerc-2",
    regulation: "NERC CIP-014",
    requirement: "Physical security plans for high-risk substations",
    status: "Compliant",
    lastVerified: new Date("2024-06-30"),
    details: "Security plans implemented and verified for Sierra Nevada Tier 3 substations",
    evidence: "Security audit completed 2024-Q2",
  },
  {
    id: "nerc-3",
    regulation: "NERC CIP-014",
    requirement: "No physical security incidents at transmission assets",
    status: "Compliant",
    lastVerified: new Date("2024-10-22"),
    details: "Zero physical security incidents YTD. Perimeter checks current.",
    evidence: "Daily security log — no incidents recorded",
  },
  {
    id: "cpuc-sla-1",
    regulation: "CPUC D.19-05-042",
    requirement: "PSPS event restoration within 48h (residential Tier 3)",
    status: "Compliant",
    lastVerified: new Date("2024-10-17"),
    details: "Restoration completed 39h 30m after de-energization. Within 48h SLA.",
    evidence: "OMS restoration timestamp: 2024-10-17 09:30",
  },
  {
    id: "veg-1",
    regulation: "CPUC GO 95 Rule 35",
    requirement: "Annual vegetation management for HFTD Tier 3 circuits",
    status: "Non-Compliant",
    lastVerified: new Date("2024-10-20"),
    details: "2 of 4 Tier 3 circuits (HTD-5370-A, HTD-5338-B) have overdue trim cycles. Work orders not yet initiated.",
    evidence: "Vegetation Management System export 2024-10-20",
  },
];

const PSPS_LOG: PspsEventLog[] = [
  {
    id: "e1",
    eventId: "PSPS-2024-001",
    date: new Date("2024-10-15"),
    region: "North Sierra",
    affectedCustomers: 847,
    medicalBaseline: 23,
    notificationTime: 26.25,
    restorationHours: 39.5,
    crcStaffed: true,
    slaBreaches: [],
    submitted: false,
  },
  {
    id: "e2",
    eventId: "FIRE-2024-002",
    date: new Date("2024-09-08"),
    region: "Tuolumne",
    affectedCustomers: 312,
    medicalBaseline: 9,
    notificationTime: 29.0,
    restorationHours: 30.0,
    crcStaffed: true,
    slaBreaches: [],
    submitted: true,
  },
  {
    id: "e3",
    eventId: "PSPS-2024-003",
    date: new Date("2024-08-12"),
    region: "Bay Area Foothills",
    affectedCustomers: 1243,
    medicalBaseline: 41,
    notificationTime: 22.0,
    restorationHours: 51.2,
    crcStaffed: true,
    slaBreaches: ["Restoration exceeded 48h SLA (+3.2h)"],
    submitted: true,
  },
];

const STATUS_CONFIG = {
  Compliant:       { icon: <CheckCircle2 className="w-4 h-4" />, badge: "bg-emerald-500/15 text-emerald-300", row: "" },
  "At Risk":       { icon: <Clock className="w-4 h-4" />, badge: "bg-amber-500/15 text-amber-300", row: "bg-amber-500/[0.03]" },
  "Non-Compliant": { icon: <XCircle className="w-4 h-4" />, badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30", row: "bg-red-500/[0.04]" },
  "N/A":           { icon: <span className="w-4 h-4 text-center">—</span>, badge: "bg-white/5 text-white/30", row: "" },
};

export default function ComplianceDashboard() {
  const [filterReg, setFilterReg] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = [...COMPLIANCE_ITEMS];
    if (filterReg !== "All") list = list.filter((i) => i.regulation.includes(filterReg));
    if (filterStatus !== "All") list = list.filter((i) => i.status === filterStatus);
    return list;
  }, [filterReg, filterStatus]);

  const stats = useMemo(() => ({
    compliant:    COMPLIANCE_ITEMS.filter((i) => i.status === "Compliant").length,
    atRisk:       COMPLIANCE_ITEMS.filter((i) => i.status === "At Risk").length,
    nonCompliant: COMPLIANCE_ITEMS.filter((i) => i.status === "Non-Compliant").length,
    total:        COMPLIANCE_ITEMS.length,
  }), []);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const exportCSV = () => {
    const rows = [
      ["Regulation", "Requirement", "Status", "Last Verified", "Details"],
      ...filtered.map((i) => [i.regulation, i.requirement, i.status, i.lastVerified.toLocaleDateString(), i.details]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Compliance report exported");
  };

  const markSubmitted = (id: string, eventId: string) => {
    toast.success(`Event ${eventId} marked as submitted to CPUC`);
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Compliant",     val: stats.compliant,    color: "text-emerald-400", bg: "border-emerald-500/20" },
          { label: "At Risk",       val: stats.atRisk,       color: "text-amber-400",   bg: "border-amber-500/20" },
          { label: "Non-Compliant", val: stats.nonCompliant, color: "text-red-400",      bg: "border-red-500/20" },
          { label: "Total Items",   val: stats.total,        color: "text-white/80",     bg: "border-white/[0.08]" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border ${s.bg} bg-white/[0.03] p-3`}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/20">requirements</p>
          </div>
        ))}
      </div>

      {/* Non-compliant alert */}
      {stats.nonCompliant > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-300">{stats.nonCompliant} non-compliant item{stats.nonCompliant > 1 ? "s" : ""} require immediate action</p>
            <p className="text-[10px] text-red-400/70 mt-0.5">Review vegetation management and pending filings below</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {["All", "CPUC", "NERC"].map((r) => (
            <button
              key={r}
              onClick={() => setFilterReg(r)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterReg === r ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {["All", "Compliant", "At Risk", "Non-Compliant"].map((s) => (
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
        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export CPUC Report
        </button>
      </div>

      {/* Compliance items */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">
          Compliance Requirements ({filtered.length})
        </h3>
        {filtered.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          const expanded = expandedItems.has(item.id);
          return (
            <div key={item.id} className={`rounded-lg border border-white/[0.08] overflow-hidden ${cfg.row}`}>
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className={`${cfg.badge.split(" ").find((c) => c.startsWith("text-")) || "text-white"}`}>
                  {cfg.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/30">{item.regulation}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white/80 mt-0.5">{item.requirement}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-white/20">
                    Verified {item.lastVerified.toLocaleDateString()}
                  </span>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                </div>
              </button>
              {expanded && (
                <div className="px-4 py-3 bg-white/[0.01] border-t border-white/[0.04] space-y-2">
                  <p className="text-xs text-white/60">{item.details}</p>
                  <p className="text-[10px] text-white/30 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    Evidence: {item.evidence}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PSPS Event Log */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white/80">PSPS Event Filing Log</h3>
        </div>
        <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                {["Event ID", "Date", "Region", "Customers", "Medical", "Notif. Lead", "Restore Time", "CRC", "SLA Breaches", "CPUC Filing"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {PSPS_LOG.map((e) => (
                <tr key={e.id} className={`hover:bg-white/[0.02] transition-colors ${e.slaBreaches.length > 0 ? "bg-red-500/[0.03]" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-white/60">{e.eventId}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{e.date.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{e.region}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{e.affectedCustomers.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{e.medicalBaseline}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${e.notificationTime >= 24 ? "text-emerald-400" : "text-red-400"}`}>
                    {e.notificationTime}h
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${e.restorationHours <= 48 ? "text-emerald-400" : "text-red-400"}`}>
                    {e.restorationHours}h
                  </td>
                  <td className={`px-4 py-3 text-xs ${e.crcStaffed ? "text-emerald-400" : "text-red-400"}`}>
                    {e.crcStaffed ? "✓" : "✗"}
                  </td>
                  <td className="px-4 py-3">
                    {e.slaBreaches.length === 0 ? (
                      <span className="text-[10px] text-emerald-400/60">None</span>
                    ) : (
                      <div className="space-y-0.5">
                        {e.slaBreaches.map((b) => (
                          <p key={b} className="text-[9px] text-red-400">{b}</p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.submitted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Filed
                      </span>
                    ) : (
                      <button
                        onClick={() => markSubmitted(e.id, e.eventId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-medium hover:bg-blue-600/30 transition-colors"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        Mark Filed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

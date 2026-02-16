import { useState, useMemo } from "react";
import { Truck, Users, Plane, Filter, ChevronDown, ChevronUp, MapPin, Clock, AlertTriangle } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

type ResourceType = "Engine" | "Crew" | "Aviation";
type ResourceStatus = "Available" | "Assigned" | "Out of Service" | "En Route" | "Staging";

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  subtype: string;
  status: ResourceStatus;
  location: string;
  assignment: string | null;
  personnel: number;
  eta: string | null;
  lastUpdate: string;
}

/* ── Mock Data ──────────────────────────────────────────────── */

const RESOURCES: Resource[] = [
  // Engines
  { id: "E-101", name: "Engine 101", type: "Engine", subtype: "Type 1 Structure", status: "Assigned", location: "Mariposa Grove", assignment: "Creek Fire - Div Alpha", personnel: 4, eta: null, lastUpdate: "14:32" },
  { id: "E-204", name: "Engine 204", type: "Engine", subtype: "Type 3 Wildland", status: "Assigned", location: "Wawona Rd", assignment: "Creek Fire - Div Bravo", personnel: 3, eta: null, lastUpdate: "14:28" },
  { id: "E-305", name: "Engine 305", type: "Engine", subtype: "Type 6 Brush", status: "En Route", location: "Hwy 41 N", assignment: "Creek Fire - Staging", personnel: 3, eta: "15 min", lastUpdate: "14:35" },
  { id: "E-112", name: "Engine 112", type: "Engine", subtype: "Type 1 Structure", status: "Available", location: "Station 12 - Oakhurst", assignment: null, personnel: 4, eta: null, lastUpdate: "14:00" },
  { id: "E-410", name: "Engine 410", type: "Engine", subtype: "Type 3 Wildland", status: "Out of Service", location: "Maintenance Yard", assignment: null, personnel: 0, eta: null, lastUpdate: "08:00" },
  { id: "E-518", name: "Engine 518", type: "Engine", subtype: "Type 6 Brush", status: "Staging", location: "Bass Lake ICP", assignment: "Creek Fire - Reserve", personnel: 3, eta: null, lastUpdate: "13:45" },

  // Crews
  { id: "C-07", name: "Hotshot Crew 7", type: "Crew", subtype: "Type 1 Hotshot", status: "Assigned", location: "Granite Ridge", assignment: "Creek Fire - Div Alpha", personnel: 20, eta: null, lastUpdate: "14:30" },
  { id: "C-14", name: "Hand Crew 14", type: "Crew", subtype: "Type 2 Hand Crew", status: "Assigned", location: "Fish Camp", assignment: "Creek Fire - Div Charlie", personnel: 18, eta: null, lastUpdate: "14:22" },
  { id: "C-21", name: "Hotshot Crew 21", type: "Crew", subtype: "Type 1 Hotshot", status: "En Route", location: "Fresno Staging", assignment: "Creek Fire - Div Bravo", personnel: 20, eta: "45 min", lastUpdate: "14:10" },
  { id: "C-33", name: "Hand Crew 33", type: "Crew", subtype: "Type 2 Hand Crew", status: "Available", location: "Bass Lake ICP", assignment: null, personnel: 17, eta: null, lastUpdate: "13:50" },
  { id: "C-09", name: "Inmate Crew 9", type: "Crew", subtype: "Type 2 Inmate Crew", status: "Assigned", location: "Sugar Pine Trail", assignment: "Creek Fire - Mop-up", personnel: 15, eta: null, lastUpdate: "14:18" },

  // Aviation
  { id: "A-T1", name: "Tanker 910", type: "Aviation", subtype: "VLAT DC-10", status: "Assigned", location: "Airborne - Div Alpha", assignment: "Creek Fire - Retardant Drop", personnel: 3, eta: null, lastUpdate: "14:33" },
  { id: "A-H3", name: "Helitack 3", type: "Aviation", subtype: "Type 1 Helicopter", status: "Assigned", location: "Airborne - N Perimeter", assignment: "Creek Fire - Bucket Drop", personnel: 4, eta: null, lastUpdate: "14:31" },
  { id: "A-H7", name: "Helitack 7", type: "Aviation", subtype: "Type 2 Helicopter", status: "Staging", location: "Fresno Air Attack Base", assignment: "Creek Fire - Standby", personnel: 3, eta: null, lastUpdate: "14:05" },
  { id: "A-T4", name: "Tanker 44", type: "Aviation", subtype: "Type 1 Airtanker", status: "En Route", location: "McClellan Airfield", assignment: "Creek Fire - Retardant", personnel: 2, eta: "25 min", lastUpdate: "14:20" },
  { id: "A-LA", name: "Lead Plane 08", type: "Aviation", subtype: "Lead / ASM", status: "Assigned", location: "Airborne - Overhead", assignment: "Creek Fire - Air Attack", personnel: 2, eta: null, lastUpdate: "14:34" },
  { id: "A-H9", name: "Helitack 9", type: "Aviation", subtype: "Type 3 Helicopter", status: "Out of Service", location: "Maintenance - Fresno", assignment: null, personnel: 0, eta: null, lastUpdate: "09:00" },
];

/* ── Config ──────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<ResourceType, { icon: typeof Truck; color: string; bg: string }> = {
  Engine: { icon: Truck, color: "text-orange-400", bg: "bg-orange-500/15" },
  Crew: { icon: Users, color: "text-sky-400", bg: "bg-sky-500/15" },
  Aviation: { icon: Plane, color: "text-violet-400", bg: "bg-violet-500/15" },
};

const STATUS_STYLES: Record<ResourceStatus, string> = {
  Available: "bg-emerald-500/20 text-emerald-300",
  Assigned: "bg-blue-500/20 text-blue-300",
  "En Route": "bg-amber-500/20 text-amber-300",
  Staging: "bg-purple-500/15 text-purple-300",
  "Out of Service": "bg-white/5 text-white/30",
};

type SortKey = "name" | "status" | "personnel" | "type";

/* ── Component ──────────────────────────────────────────────── */

export default function ResourceTracker() {
  const [filterType, setFilterType] = useState<ResourceType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<ResourceStatus | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let list = [...RESOURCES];
    if (filterType !== "All") list = list.filter((r) => r.type === filterType);
    if (filterStatus !== "All") list = list.filter((r) => r.status === filterStatus);

    const statusOrder: Record<ResourceStatus, number> = {
      "En Route": 0, Assigned: 1, Staging: 2, Available: 3, "Out of Service": 4,
    };

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status") cmp = statusOrder[a.status] - statusOrder[b.status];
      else if (sortKey === "personnel") cmp = b.personnel - a.personnel;
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "type") cmp = a.type.localeCompare(b.type);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filterType, filterStatus, sortKey, sortAsc]);

  /* Summary stats */
  const summary = useMemo(() => {
    const total = RESOURCES.length;
    const assigned = RESOURCES.filter((r) => r.status === "Assigned").length;
    const enRoute = RESOURCES.filter((r) => r.status === "En Route").length;
    const available = RESOURCES.filter((r) => r.status === "Available").length;
    const oos = RESOURCES.filter((r) => r.status === "Out of Service").length;
    const totalPersonnel = RESOURCES.reduce((s, r) => s + r.personnel, 0);
    return { total, assigned, enRoute, available, oos, totalPersonnel };
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-white/15" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-white/50" /> : <ChevronDown className="w-3 h-3 text-white/50" />;
  };

  return (
    <div className="space-y-5">
      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Resources" value={summary.total} color="text-white/80" />
        <SummaryCard label="Assigned" value={summary.assigned} color="text-blue-400" />
        <SummaryCard label="En Route" value={summary.enRoute} color="text-amber-400" />
        <SummaryCard label="Available" value={summary.available} color="text-emerald-400" />
        <SummaryCard label="Out of Service" value={summary.oos} color="text-white/30" />
        <SummaryCard label="Total Personnel" value={summary.totalPersonnel} color="text-sky-300" />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </div>
        <div className="flex gap-1.5">
          {(["All", "Engine", "Crew", "Aviation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                filterType === t
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-white/10">|</span>
        <div className="flex gap-1.5 flex-wrap">
          {(["All", "Assigned", "En Route", "Available", "Staging", "Out of Service"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resource Table ─────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("name")}>
                <span className="inline-flex items-center gap-1">Resource <SortIcon col="name" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("type")}>
                <span className="inline-flex items-center gap-1">Type <SortIcon col="type" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Subtype</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("status")}>
                <span className="inline-flex items-center gap-1">Status <SortIcon col="status" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Assignment</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("personnel")}>
                <span className="inline-flex items-center gap-1">Personnel <SortIcon col="personnel" /></span>
              </th>
              <th className="px-4 py-3 font-medium">ETA</th>
              <th className="px-4 py-3 font-medium">Last Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((r) => {
              const cfg = TYPE_CONFIG[r.type];
              const Icon = cfg.icon;
              return (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-[11px] text-white/40">{r.id}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs">{r.type}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">{r.subtype}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-white/50">
                      <MapPin className="w-3 h-3" />
                      {r.location}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.assignment ? (
                      <span className="text-white/70">{r.assignment}</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-white/60">{r.personnel || "—"}</td>
                  <td className="px-4 py-3">
                    {r.eta ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        {r.eta}
                      </span>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/30">{r.lastUpdate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-white/20 px-1">
        Showing {filtered.length} of {RESOURCES.length} resources · Data from ICS-209 resource tracking
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

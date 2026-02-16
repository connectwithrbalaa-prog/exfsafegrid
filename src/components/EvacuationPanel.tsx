import { useMemo } from "react";
import {
  Route, AlertTriangle, Clock, Users, Car, ChevronRight,
} from "lucide-react";
import {
  EVAC_ROUTES, BOTTLENECKS, ZONE_ETES,
  ROUTE_STYLES, BOTTLENECK_STYLES, BOTTLENECK_ICONS,
  type ZoneETE,
} from "@/lib/evacuation-data";

/* ── Component: Evacuation info panel below the map ──────────── */

export default function EvacuationPanel() {
  const totalPop = useMemo(() => ZONE_ETES.reduce((s, z) => s + z.population, 0), []);
  const totalVehicles = useMemo(() => ZONE_ETES.reduce((s, z) => s + z.vehicles, 0), []);
  const maxETE = useMemo(() => Math.max(...ZONE_ETES.map((z) => z.stressedEteMin)), []);
  const critBottlenecks = BOTTLENECKS.filter((b) => b.severity === "critical").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniCard icon={<Users className="w-4 h-4 text-blue-400" />} label="Total Population" value={totalPop.toLocaleString()} />
        <MiniCard icon={<Car className="w-4 h-4 text-cyan-400" />} label="Est. Vehicles" value={totalVehicles.toLocaleString()} />
        <MiniCard icon={<Clock className="w-4 h-4 text-amber-400" />} label="Max ETE (Stressed)" value={`${maxETE} min`} highlight />
        <MiniCard icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="Critical Bottlenecks" value={String(critBottlenecks)} highlight={critBottlenecks > 0} />
      </div>

      {/* Zone ETE Table */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Evacuation Time Estimates by Zone
          </h3>
          <span className="text-[10px] text-white/30">{ZONE_ETES.length} zones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                <th className="px-5 py-3 font-medium">Zone</th>
                <th className="px-5 py-3 font-medium">Population</th>
                <th className="px-5 py-3 font-medium">Vehicles</th>
                <th className="px-5 py-3 font-medium">Normal ETE</th>
                <th className="px-5 py-3 font-medium">Stressed ETE</th>
                <th className="px-5 py-3 font-medium">Primary Route</th>
                <th className="px-5 py-3 font-medium">Alternate</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {ZONE_ETES.map((z) => (
                <tr key={z.zone} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 font-medium">{z.zone}</td>
                  <td className="px-5 py-3 text-white/60 tabular-nums">{z.population.toLocaleString()}</td>
                  <td className="px-5 py-3 text-white/60 tabular-nums">{z.vehicles.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <ETEBar minutes={z.normalEteMin} max={120} color="#4ade80" />
                  </td>
                  <td className="px-5 py-3">
                    <ETEBar minutes={z.stressedEteMin} max={120} color={z.stressedEteMin > 90 ? "#ef4444" : z.stressedEteMin > 60 ? "#f59e0b" : "#4ade80"} />
                  </td>
                  <td className="px-5 py-3 text-white/60 text-xs">{z.primaryRoute}</td>
                  <td className="px-5 py-3 text-white/40 text-xs">{z.alternateRoute}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={z.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Routes & Bottlenecks side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Routes */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Route className="w-4 h-4 text-emerald-400" />
              Evacuation Routes
            </h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {EVAC_ROUTES.map((r) => {
              const style = ROUTE_STYLES[r.type];
              return (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                  <span className="w-8 h-1 rounded-full" style={{ backgroundColor: style.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-[10px] text-white/30">
                      {r.type.toUpperCase()} · {r.lengthMi} mi · {r.capacityVehiclesHr.toLocaleString()} veh/hr
                    </div>
                  </div>
                  <div className="text-[10px] text-white/20 text-right">
                    {r.zones.map((z) => z.split("—")[0].trim()).join(", ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottlenecks */}
        <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Bottleneck Points
            </h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {BOTTLENECKS.map((b) => {
              const style = BOTTLENECK_STYLES[b.severity];
              return (
                <div key={b.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{BOTTLENECK_ICONS[b.type]}</span>
                    <span className="text-sm font-medium">{b.name}</span>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ml-auto"
                      style={{ backgroundColor: `${style.color}20`, color: style.color }}
                    >
                      {b.severity} · +{b.delayMinutes} min
                    </span>
                  </div>
                  <p className="text-[11px] text-white/30 leading-relaxed">{b.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-white/15 px-1">
        ETEs computed per WFDSS methodology using population, vehicle estimates, route capacity, and bottleneck delays. Stressed conditions assume 60% capacity reduction from smoke, debris, or contraflow operations.
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function MiniCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-amber-500/30 bg-amber-500/5" : "border-white/[0.08] bg-[hsl(220,25%,9%)]"}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-xl font-bold tabular-nums ${highlight ? "text-amber-400" : "text-white/90"}`}>{value}</span>
    </div>
  );
}

function ETEBar({ minutes, max, color }: { minutes: number; max: number; color: string }) {
  const pct = Math.min((minutes / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono text-white/60">{minutes}m</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ZoneETE["status"] }) {
  const styles: Record<string, string> = {
    Clear: "bg-emerald-500/15 text-emerald-300",
    Congested: "bg-amber-500/15 text-amber-300",
    Blocked: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] || styles.Clear}`}>
      {status}
    </span>
  );
}

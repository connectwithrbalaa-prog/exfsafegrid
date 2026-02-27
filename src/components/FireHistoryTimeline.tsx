import { useState, useMemo } from "react";
import { Flame, ChevronDown, ChevronUp, AlertTriangle, Calendar, MapPin, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import { FirePoint, SUBSTATIONS, haversineKm } from "@/lib/wildfire-utils";
import { use7DayOutlook, useMonthlyOutlook } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ── Historical Fire Data (unchanged) ──────────────────────── */

interface HistoricalFire {
  id: string;
  name: string;
  year: number;
  startDate: string;
  containedDate: string;
  durationDays: number;
  acresBurned: number;
  cause: string;
  peakPersonnel: number;
  structuresDestroyed: number;
  fatalities: number;
  lat: number;
  lng: number;
  spreadPattern: "wind-driven" | "terrain-driven" | "fuel-driven" | "spotting";
  peakSpreadRateMph: number;
  affectedZips: string[];
  riskZoneOverlap: string[];
  maxFrp: number;
}

const HISTORICAL_FIRES: HistoricalFire[] = [
  {
    id: "creek-2020", name: "Creek Fire", year: 2020, startDate: "Sep 4, 2020", containedDate: "Dec 24, 2020",
    durationDays: 111, acresBurned: 379895, cause: "Unknown", peakPersonnel: 2042,
    structuresDestroyed: 856, fatalities: 0, lat: 37.19, lng: -119.25,
    spreadPattern: "wind-driven", peakSpreadRateMph: 15,
    affectedZips: ["93644", "93614", "93602", "93604"], riskZoneOverlap: ["Zone A — North Highlands", "Zone D — Foothill East"],
    maxFrp: 28.5,
  },
  {
    id: "ferguson-2018", name: "Ferguson Fire", year: 2018, startDate: "Jul 13, 2018", containedDate: "Aug 18, 2018",
    durationDays: 36, acresBurned: 96901, cause: "Vehicle", peakPersonnel: 3100,
    structuresDestroyed: 10, fatalities: 2, lat: 37.65, lng: -119.85,
    spreadPattern: "terrain-driven", peakSpreadRateMph: 6,
    affectedZips: ["93623", "93604"], riskZoneOverlap: ["Zone A — North Highlands"],
    maxFrp: 18.2,
  },
  {
    id: "rim-2013", name: "Rim Fire", year: 2013, startDate: "Aug 17, 2013", containedDate: "Oct 24, 2013",
    durationDays: 68, acresBurned: 257314, cause: "Illegal campfire", peakPersonnel: 5046,
    structuresDestroyed: 112, fatalities: 0, lat: 37.85, lng: -119.85,
    spreadPattern: "fuel-driven", peakSpreadRateMph: 12,
    affectedZips: ["93623"], riskZoneOverlap: ["Zone A — North Highlands"],
    maxFrp: 35.1,
  },
  {
    id: "dog-rock-2014", name: "Dog Rock Fire", year: 2014, startDate: "Oct 6, 2014", containedDate: "Oct 11, 2014",
    durationDays: 5, acresBurned: 400, cause: "Rockfall/sparks", peakPersonnel: 340,
    structuresDestroyed: 0, fatalities: 0, lat: 37.71, lng: -119.64,
    spreadPattern: "spotting", peakSpreadRateMph: 3,
    affectedZips: ["93623"], riskZoneOverlap: [],
    maxFrp: 4.8,
  },
  {
    id: "south-fork-2017", name: "South Fork Fire", year: 2017, startDate: "Aug 29, 2017", containedDate: "Sep 21, 2017",
    durationDays: 23, acresBurned: 4450, cause: "Lightning", peakPersonnel: 680,
    structuresDestroyed: 3, fatalities: 0, lat: 37.50, lng: -119.55,
    spreadPattern: "terrain-driven", peakSpreadRateMph: 5,
    affectedZips: ["93644", "93604"], riskZoneOverlap: ["Zone A — North Highlands"],
    maxFrp: 8.3,
  },
  {
    id: "railroad-2017", name: "Railroad Fire", year: 2017, startDate: "Aug 29, 2017", containedDate: "Sep 6, 2017",
    durationDays: 8, acresBurned: 12410, cause: "Railroad sparks", peakPersonnel: 1253,
    structuresDestroyed: 5, fatalities: 0, lat: 37.55, lng: -119.97,
    spreadPattern: "wind-driven", peakSpreadRateMph: 8,
    affectedZips: ["93644", "93623"], riskZoneOverlap: ["Zone A — North Highlands"],
    maxFrp: 14.7,
  },
  {
    id: "washburn-2022", name: "Washburn Fire", year: 2022, startDate: "Jul 7, 2022", containedDate: "Aug 7, 2022",
    durationDays: 31, acresBurned: 4886, cause: "Unknown", peakPersonnel: 850,
    structuresDestroyed: 0, fatalities: 0, lat: 37.50, lng: -119.58,
    spreadPattern: "terrain-driven", peakSpreadRateMph: 4,
    affectedZips: ["93623", "93644"], riskZoneOverlap: ["Zone A — North Highlands"],
    maxFrp: 7.1,
  },
  {
    id: "oak-2022", name: "Oak Fire", year: 2022, startDate: "Jul 22, 2022", containedDate: "Aug 5, 2022",
    durationDays: 14, acresBurned: 19244, cause: "Equipment use", peakPersonnel: 3300,
    structuresDestroyed: 182, fatalities: 0, lat: 37.55, lng: -119.92,
    spreadPattern: "wind-driven", peakSpreadRateMph: 10,
    affectedZips: ["93644", "93614"], riskZoneOverlap: ["Zone A — North Highlands", "Zone B — Valley Central"],
    maxFrp: 22.6,
  },
];

const SPREAD_COLORS: Record<string, string> = {
  "wind-driven": "#F87171",
  "terrain-driven": "#FBBF24",
  "fuel-driven": "#FB923C",
  "spotting": "#A78BFA",
};

const SPREAD_LABELS: Record<string, string> = {
  "wind-driven": "Wind-Driven",
  "terrain-driven": "Terrain-Driven",
  "fuel-driven": "Fuel-Driven",
  "spotting": "Spotting",
};

const POTENTIAL_COLORS: Record<number, string> = {
  1: "text-green-500",
  2: "text-green-400",
  3: "text-yellow-500",
  4: "text-orange-500",
  5: "text-red-500",
};

/* ── Live Outlook Section ──────────────────────────────────── */

const PERIOD_OPTIONS = ["Day1", "Day2", "Day3", "Day4", "Day5", "Day6", "Day7"];

function LiveOutlookSection() {
  const [period, setPeriod] = useState("Day1");
  const { data: outlook7, isLoading: loading7, isError: err7 } = use7DayOutlook({ period_label: period });
  const { data: outlookM, isLoading: loadingM, isError: errM } = useMonthlyOutlook({ period_label: "Month1" });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/50 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            7-Day Fire Potential Outlook
          </h3>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading7 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : err7 ? (
          <div className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed to load 7-day outlook
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/30 border-b border-white/[0.06]">
                  <th className="px-3 py-2 font-medium">PSA</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Potential (1–5)</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Forecast Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(outlook7?.outlooks ?? []).slice(0, 20).map((o, i) => (
                  <tr key={`${o.psa_id}-${i}`} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-white/70">{o.psa_id}</td>
                    <td className="px-3 py-2 text-white/50">{o.period_label}</td>
                    <td className={`px-3 py-2 font-bold ${POTENTIAL_COLORS[o.fire_potential] ?? "text-white/50"}`}>
                      {o.fire_potential}
                    </td>
                    <td className="px-3 py-2 text-white/60">{o.fire_potential_label}</td>
                    <td className="px-3 py-2 text-white/40">{o.forecast_date}</td>
                  </tr>
                ))}
                {(outlook7?.outlooks ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-white/30">No outlook data for {period}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly outlook summary */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold text-white/50 flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          Monthly Fire Potential Outlook (Month 1)
        </h3>
        {loadingM ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : errM ? (
          <div className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed to load monthly outlook
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/30 border-b border-white/[0.06]">
                  <th className="px-3 py-2 font-medium">PSA</th>
                  <th className="px-3 py-2 font-medium">Potential</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Forecast Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(outlookM?.outlooks ?? []).slice(0, 10).map((o, i) => (
                  <tr key={`${o.psa_id}-${i}`} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-white/70">{o.psa_id}</td>
                    <td className={`px-3 py-2 font-bold ${POTENTIAL_COLORS[o.fire_potential] ?? "text-white/50"}`}>
                      {o.fire_potential}
                    </td>
                    <td className="px-3 py-2 text-white/60">{o.fire_potential_label}</td>
                    <td className="px-3 py-2 text-white/40">{o.forecast_date}</td>
                  </tr>
                ))}
                {(outlookM?.outlooks ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-white/30">No monthly outlook data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

interface Props {
  fires: FirePoint[];
}

type SortKey = "year" | "acres" | "duration" | "structures";

export default function FireHistoryTimeline({ fires }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<string | "All">("All");

  const filtered = useMemo(() => {
    let list = [...HISTORICAL_FIRES];
    if (selectedPattern !== "All") list = list.filter((f) => f.spreadPattern === selectedPattern);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "year") cmp = b.year - a.year;
      else if (sortKey === "acres") cmp = b.acresBurned - a.acresBurned;
      else if (sortKey === "duration") cmp = b.durationDays - a.durationDays;
      else if (sortKey === "structures") cmp = b.structuresDestroyed - a.structuresDestroyed;
      return sortAsc ? -cmp : cmp;
    });
    return list;
  }, [sortKey, sortAsc, selectedPattern]);

  const correlations = useMemo(() => {
    return HISTORICAL_FIRES.map((hf) => {
      const currentFiresNearby = fires.filter(
        (f) => haversineKm(hf.lat, hf.lng, f.latitude, f.longitude) <= 30
      ).length;
      return { id: hf.id, name: hf.name, year: hf.year, currentFiresNearby };
    }).sort((a, b) => b.currentFiresNearby - a.currentFiresNearby);
  }, [fires]);

  const decadeSummary = useMemo(() => {
    const decades: Record<string, { fires: number; acres: number; structures: number }> = {};
    HISTORICAL_FIRES.forEach((f) => {
      const decade = `${Math.floor(f.year / 10) * 10}s`;
      if (!decades[decade]) decades[decade] = { fires: 0, acres: 0, structures: 0 };
      decades[decade].fires++;
      decades[decade].acres += f.acresBurned;
      decades[decade].structures += f.structuresDestroyed;
    });
    return Object.entries(decades).map(([decade, d]) => ({ decade, ...d })).sort((a, b) => a.decade.localeCompare(b.decade));
  }, []);

  const yearlyData = useMemo(() => {
    return HISTORICAL_FIRES
      .map((f) => ({ year: f.year, name: f.name, acres: f.acresBurned, spread: f.spreadPattern }))
      .sort((a, b) => a.year - b.year);
  }, []);

  const patternCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    HISTORICAL_FIRES.forEach((f) => {
      counts[f.spreadPattern] = (counts[f.spreadPattern] || 0) + 1;
    });
    return Object.entries(counts).map(([pattern, count]) => ({
      pattern: SPREAD_LABELS[pattern],
      count,
      color: SPREAD_COLORS[pattern],
    }));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-white/15" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-white/50" /> : <ChevronDown className="w-3 h-3 text-white/50" />;
  };

  const totalAcres = HISTORICAL_FIRES.reduce((s, f) => s + f.acresBurned, 0);
  const totalStructures = HISTORICAL_FIRES.reduce((s, f) => s + f.structuresDestroyed, 0);
  const avgDuration = Math.round(HISTORICAL_FIRES.reduce((s, f) => s + f.durationDays, 0) / HISTORICAL_FIRES.length);

  return (
    <div className="space-y-5">
      {/* ── Summary ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HistSummaryCard label="Historical Fires" value={HISTORICAL_FIRES.length} color="text-white/80" />
        <HistSummaryCard label="Total Acres" value={totalAcres.toLocaleString()} color="text-orange-400" />
        <HistSummaryCard label="Structures Lost" value={totalStructures.toLocaleString()} color="text-red-400" />
        <HistSummaryCard label="Avg Duration" value={`${avgDuration}d`} color="text-amber-400" />
        <HistSummaryCard label="Active Overlap" value={correlations.filter((c) => c.currentFiresNearby > 0).length} color="text-sky-400" sub="zones with current fires" />
        <HistSummaryCard label="Span" value="2013–2022" color="text-white/50" />
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Acres Burned by Incident
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearlyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
                formatter={(v: number) => [v.toLocaleString() + " acres", "Burned"]}
              />
              <Bar dataKey="acres" radius={[4, 4, 0, 0]}>
                {yearlyData.map((d, i) => (
                  <Cell key={i} fill={SPREAD_COLORS[d.spread]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            Current Fires Near Historical Burn Areas
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={correlations} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} layout="vertical">
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
                formatter={(v: number) => [v, "Active fires within 30 km"]}
              />
              <Bar dataKey="currentFiresNearby" radius={[0, 4, 4, 0]}>
                {correlations.map((d, i) => (
                  <Cell key={i} fill={d.currentFiresNearby > 3 ? "#EF4444" : d.currentFiresNearby > 0 ? "#FBBF24" : "#334155"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Spread Pattern Legend + Filter ─────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-white/40 font-medium">Spread Pattern:</span>
        {(["All", "wind-driven", "terrain-driven", "fuel-driven", "spotting"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPattern(p)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
              selectedPattern === p
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50"
            }`}
          >
            {p !== "All" && <span className="w-2 h-2 rounded-full" style={{ background: SPREAD_COLORS[p] }} />}
            {p === "All" ? "All" : SPREAD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── Incident Table ────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-medium w-8" />
              <th className="px-4 py-3 font-medium">Incident</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("year")}>
                <span className="inline-flex items-center gap-1">Year <SortIcon col="year" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Spread</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("acres")}>
                <span className="inline-flex items-center gap-1">Acres <SortIcon col="acres" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("duration")}>
                <span className="inline-flex items-center gap-1">Duration <SortIcon col="duration" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("structures")}>
                <span className="inline-flex items-center gap-1">Structures <SortIcon col="structures" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Cause</th>
              <th className="px-4 py-3 font-medium">Current Overlap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((f) => {
              const corr = correlations.find((c) => c.id === f.id);
              const nearbyCount = corr?.currentFiresNearby || 0;
              return (
                <>
                  <tr
                    key={f.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  >
                    <td className="px-4 py-3 text-white/20">
                      {expandedId === f.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5" style={{ color: SPREAD_COLORS[f.spreadPattern] }} />
                      {f.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/50">{f.year}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: `${SPREAD_COLORS[f.spreadPattern]}20`, color: SPREAD_COLORS[f.spreadPattern] }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: SPREAD_COLORS[f.spreadPattern] }} />
                        {SPREAD_LABELS[f.spreadPattern]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/70">{f.acresBurned.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white/50">{f.durationDays} days</td>
                    <td className="px-4 py-3">
                      {f.structuresDestroyed > 0 ? (
                        <span className="text-red-400 font-semibold">{f.structuresDestroyed}</span>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">{f.cause}</td>
                    <td className="px-4 py-3">
                      {nearbyCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          {nearbyCount} active
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">None</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === f.id && (
                    <tr key={`${f.id}-detail`} className="bg-white/[0.01]">
                      <td colSpan={9} className="px-8 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
                          <DetailItem label="Start Date" value={f.startDate} />
                          <DetailItem label="Contained" value={f.containedDate} />
                          <DetailItem label="Peak Personnel" value={f.peakPersonnel.toLocaleString()} />
                          <DetailItem label="Peak Spread" value={`${f.peakSpreadRateMph} mph`} />
                          <DetailItem label="Max FRP" value={`${f.maxFrp} MW`} />
                          <DetailItem label="Fatalities" value={String(f.fatalities)} />
                        </div>
                        {f.riskZoneOverlap.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/[0.04]">
                            <span className="text-[10px] uppercase tracking-wider text-white/30 mr-2">Risk Zone Overlap:</span>
                            {f.riskZoneOverlap.map((z) => (
                              <span key={z} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-300 border border-red-500/20 mr-1.5">
                                {z}
                              </span>
                            ))}
                          </div>
                        )}
                        {f.affectedZips.length > 0 && (
                          <div className="mt-2">
                            <span className="text-[10px] uppercase tracking-wider text-white/30 mr-2">Affected ZIPs:</span>
                            {f.affectedZips.map((z) => (
                              <span key={z} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-white/40 mr-1.5">
                                {z}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-white/20 px-1">
        Historical data from CAL FIRE / NIFC incident records · Current overlap uses 30 km proximity to historical fire origins
      </div>

      {/* ── Live Outlook Section (from FastAPI) ────────── */}
      <div className="border-t border-white/[0.06] pt-5 mt-2">
        <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          Live Fire Potential Outlooks
        </h2>
        <LiveOutlookSection />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function HistSummaryCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">{label}</div>
      <div className="font-semibold text-white/70">{value}</div>
    </div>
  );
}

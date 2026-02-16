import { useMemo, useState } from "react";
import { Flame, Wind, Droplets, Mountain, ChevronDown, ChevronUp, AlertTriangle, ArrowUp, Info } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { FirePoint, haversineKm } from "@/lib/wildfire-utils";

/* ── Types ──────────────────────────────────────────────────── */

export interface WeatherPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  temperature_f: number;
  humidity_pct: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
}

export interface FirePrediction {
  id: string;
  fireLat: number;
  fireLng: number;
  frp: number;
  nearestWeather: WeatherPoint;
  /* Fuel model */
  fuelType: string;
  fuelMoisture: number;       // % (dead fuel moisture content)
  fuelLoad: number;           // tons/acre
  /* Terrain */
  slope: number;              // degrees
  aspect: number;             // degrees (compass direction slope faces)
  elevation: number;          // feet
  /* Spread prediction */
  spreadRate: number;         // chains/hour (Rothermel output)
  spreadRateMph: number;
  spreadDirection: number;    // degrees — predicted head fire direction
  flameLength: number;        // feet
  firelineIntensity: number;  // BTU/ft/s
  spotPotentialMi: number;    // miles — spotting distance
  severity: "Extreme" | "Very High" | "High" | "Moderate" | "Low";
}

/* ── Terrain & Fuel Mock Data (per-region) ──────────────────── */

interface TerrainCell {
  lat: number;
  lng: number;
  slope: number;
  aspect: number;
  elevation: number;
  fuelType: string;
  fuelLoad: number;
}

const TERRAIN_GRID: TerrainCell[] = [
  { lat: 37.50, lng: -119.60, slope: 28, aspect: 225, elevation: 6200, fuelType: "Timber Litter", fuelLoad: 3.2 },
  { lat: 37.33, lng: -119.65, slope: 15, aspect: 180, elevation: 3400, fuelType: "Brush", fuelLoad: 4.5 },
  { lat: 37.32, lng: -119.56, slope: 12, aspect: 160, elevation: 3100, fuelType: "Grass-Shrub", fuelLoad: 2.8 },
  { lat: 37.48, lng: -119.64, slope: 32, aspect: 200, elevation: 5800, fuelType: "Timber Understory", fuelLoad: 5.1 },
  { lat: 37.23, lng: -119.51, slope: 20, aspect: 270, elevation: 2800, fuelType: "Chaparral", fuelLoad: 6.2 },
  { lat: 37.26, lng: -119.70, slope: 8, aspect: 190, elevation: 2200, fuelType: "Grass", fuelLoad: 1.5 },
  { lat: 37.74, lng: -119.59, slope: 35, aspect: 240, elevation: 4000, fuelType: "Timber Litter", fuelLoad: 3.8 },
  { lat: 37.67, lng: -119.78, slope: 25, aspect: 210, elevation: 3200, fuelType: "Brush", fuelLoad: 5.0 },
  { lat: 37.54, lng: -119.66, slope: 30, aspect: 195, elevation: 5200, fuelType: "Timber Understory", fuelLoad: 4.8 },
  { lat: 37.36, lng: -119.73, slope: 10, aspect: 170, elevation: 2600, fuelType: "Grass-Shrub", fuelLoad: 2.2 },
  { lat: 37.21, lng: -119.91, slope: 5, aspect: 150, elevation: 1100, fuelType: "Grass", fuelLoad: 1.2 },
  { lat: 37.56, lng: -119.97, slope: 18, aspect: 220, elevation: 2900, fuelType: "Chaparral", fuelLoad: 5.5 },
];

/* ── Simplified Rothermel Spread Model ──────────────────────── */

function computeFuelMoisture(humidity: number, temperature_f: number): number {
  // Dead fuel moisture approximation from relative humidity and temperature
  // Fine dead fuel moisture ≈ 1.28 × RH^0.58 (simplified Nelson model)
  const base = 1.28 * Math.pow(humidity, 0.58);
  // Temperature correction: higher temp → lower moisture
  const tempCorrection = Math.max(0, (temperature_f - 60) * 0.04);
  return Math.max(2, base - tempCorrection);
}

function rothermelSpreadRate(
  fuelLoad: number,     // tons/acre
  fuelMoisture: number, // %
  windSpeedMph: number,
  slopeDeg: number,
  windDir: number,
  aspect: number,
): { spreadRate: number; direction: number } {
  // Simplified Rothermel surface fire spread model
  // R = R0 × (1 + φw + φs) where R0 is no-wind no-slope rate

  // Base spread rate from fuel load and moisture
  const moistureRatio = fuelMoisture / 25; // normalized to extinction moisture
  const dampingCoeff = Math.max(0, 1 - 2.5 * moistureRatio);
  const R0 = fuelLoad * 8 * dampingCoeff; // chains/hour base

  // Wind factor: φw = C × (U^B) / (β/βop)^E  — simplified
  const phiW = 0.4 * Math.pow(windSpeedMph, 1.2);

  // Slope factor: φs = 5.275 × β^-0.3 × tan²(slope)
  const slopeRad = (slopeDeg * Math.PI) / 180;
  const phiS = 5.275 * Math.pow(Math.tan(slopeRad), 2);

  const spreadRate = Math.max(0.5, R0 * (1 + phiW + phiS));

  // Spread direction: combination of wind direction and upslope
  // Wind pushes fire in the direction wind is blowing TO (windDir + 180)
  // Slope pushes fire upslope (aspect direction)
  const windPush = ((windDir + 180) % 360) * (Math.PI / 180);
  const slopePush = (aspect * Math.PI) / 180;
  const windWeight = windSpeedMph / (windSpeedMph + slopeDeg * 0.5 + 1);
  const slopeWeight = 1 - windWeight;
  const dx = windWeight * Math.sin(windPush) + slopeWeight * Math.sin(slopePush);
  const dy = windWeight * Math.cos(windPush) + slopeWeight * Math.cos(slopePush);
  const direction = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  return { spreadRate, direction };
}

function computeFlameLength(spreadRate: number, fuelLoad: number): number {
  // Byram's fireline intensity: I = H × w × R
  // Flame length: L = 0.45 × I^0.46
  const heatContent = 8000; // BTU/lb
  const w = fuelLoad * 2000; // lbs/acre
  const R = spreadRate * 66 / 60; // ft/min from chains/hr
  const I = heatContent * (w / 43560) * R;
  return 0.45 * Math.pow(Math.max(1, I), 0.46);
}

function getSeverity(spreadRate: number, flameLength: number): FirePrediction["severity"] {
  if (spreadRate > 80 || flameLength > 20) return "Extreme";
  if (spreadRate > 40 || flameLength > 11) return "Very High";
  if (spreadRate > 20 || flameLength > 6) return "High";
  if (spreadRate > 8 || flameLength > 3) return "Moderate";
  return "Low";
}

const SEVERITY_COLORS: Record<FirePrediction["severity"], string> = {
  Extreme: "#DC2626",
  "Very High": "#EF4444",
  High: "#F97316",
  Moderate: "#FBBF24",
  Low: "#34D399",
};

const SEVERITY_BG: Record<FirePrediction["severity"], string> = {
  Extreme: "bg-red-600/20 text-red-300 ring-1 ring-red-500/40",
  "Very High": "bg-red-500/15 text-red-300",
  High: "bg-orange-500/15 text-orange-300",
  Moderate: "bg-amber-500/15 text-amber-300",
  Low: "bg-emerald-500/15 text-emerald-300",
};

/* ── Component ──────────────────────────────────────────────── */

interface Props {
  fires: FirePoint[];
  weatherData: WeatherPoint[];
}

type SortKey = "spread" | "flame" | "severity" | "fuel";

export default function FireBehaviorPanel({ fires, weatherData }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("spread");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const predictions = useMemo<FirePrediction[]>(() => {
    // For each fire within 50 km of any terrain cell, compute prediction
    const results: FirePrediction[] = [];
    const seen = new Set<string>();

    for (const fire of fires) {
      // Find nearest terrain cell
      let bestTerrain: TerrainCell | null = null;
      let bestTerrainDist = Infinity;
      for (const t of TERRAIN_GRID) {
        const d = haversineKm(fire.latitude, fire.longitude, t.lat, t.lng);
        if (d < bestTerrainDist) {
          bestTerrainDist = d;
          bestTerrain = t;
        }
      }
      if (!bestTerrain || bestTerrainDist > 30) continue;

      // Deduplicate by grid cell
      const cellKey = `${bestTerrain.lat}-${bestTerrain.lng}`;
      if (seen.has(cellKey)) continue;
      seen.add(cellKey);

      // Find nearest weather station
      let bestWeather: WeatherPoint | null = null;
      let bestWeatherDist = Infinity;
      for (const w of weatherData) {
        const d = haversineKm(fire.latitude, fire.longitude, w.latitude, w.longitude);
        if (d < bestWeatherDist) {
          bestWeatherDist = d;
          bestWeather = w;
        }
      }
      if (!bestWeather) continue;

      const fuelMoisture = computeFuelMoisture(bestWeather.humidity_pct, bestWeather.temperature_f);
      const { spreadRate, direction } = rothermelSpreadRate(
        bestTerrain.fuelLoad,
        fuelMoisture,
        bestWeather.wind_speed_mph,
        bestTerrain.slope,
        bestWeather.wind_direction_deg,
        bestTerrain.aspect,
      );
      const flameLength = computeFlameLength(spreadRate, bestTerrain.fuelLoad);
      const firelineIntensity = Math.round(flameLength * spreadRate * 12);
      const spotPotential = Math.min(5, flameLength * 0.15 + bestWeather.wind_speed_mph * 0.08);
      const severity = getSeverity(spreadRate, flameLength);

      results.push({
        id: cellKey,
        fireLat: fire.latitude,
        fireLng: fire.longitude,
        frp: fire.frp,
        nearestWeather: bestWeather,
        fuelType: bestTerrain.fuelType,
        fuelMoisture: Math.round(fuelMoisture * 10) / 10,
        fuelLoad: bestTerrain.fuelLoad,
        slope: bestTerrain.slope,
        aspect: bestTerrain.aspect,
        elevation: bestTerrain.elevation,
        spreadRate: Math.round(spreadRate * 10) / 10,
        spreadRateMph: Math.round((spreadRate * 66 / 5280) * 60 * 10) / 10,
        spreadDirection: Math.round(direction),
        flameLength: Math.round(flameLength * 10) / 10,
        firelineIntensity,
        spotPotentialMi: Math.round(spotPotential * 10) / 10,
        severity,
      });
    }

    return results;
  }, [fires, weatherData]);

  const sorted = useMemo(() => {
    const sevOrder: Record<string, number> = { Extreme: 0, "Very High": 1, High: 2, Moderate: 3, Low: 4 };
    const list = [...predictions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "spread") cmp = b.spreadRate - a.spreadRate;
      else if (sortKey === "flame") cmp = b.flameLength - a.flameLength;
      else if (sortKey === "severity") cmp = sevOrder[a.severity] - sevOrder[b.severity];
      else if (sortKey === "fuel") cmp = a.fuelMoisture - b.fuelMoisture;
      return sortAsc ? -cmp : cmp;
    });
    return list;
  }, [predictions, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-white/15" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-white/50" /> : <ChevronDown className="w-3 h-3 text-white/50" />;
  };

  /* Summary */
  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { Extreme: 0, "Very High": 0, High: 0, Moderate: 0, Low: 0 };
    predictions.forEach((p) => c[p.severity]++);
    return c;
  }, [predictions]);

  const maxSpread = predictions.length > 0 ? Math.max(...predictions.map((p) => p.spreadRate)) : 0;
  const avgFlame = predictions.length > 0 ? Math.round(predictions.reduce((s, p) => s + p.flameLength, 0) / predictions.length * 10) / 10 : 0;
  const avgMoisture = predictions.length > 0 ? Math.round(predictions.reduce((s, p) => s + p.fuelMoisture, 0) / predictions.length * 10) / 10 : 0;

  /* Radar data for selected prediction */
  const selectedPred = expandedId ? predictions.find((p) => p.id === expandedId) : null;
  const radarData = selectedPred ? [
    { factor: "Wind Speed", value: Math.min(100, selectedPred.nearestWeather.wind_speed_mph * 4), fullMark: 100 },
    { factor: "Slope", value: Math.min(100, selectedPred.slope * 2.5), fullMark: 100 },
    { factor: "Fuel Load", value: Math.min(100, selectedPred.fuelLoad * 15), fullMark: 100 },
    { factor: "Dryness", value: Math.min(100, 100 - selectedPred.fuelMoisture * 5), fullMark: 100 },
    { factor: "Intensity (FRP)", value: Math.min(100, selectedPred.frp * 5), fullMark: 100 },
    { factor: "Temperature", value: Math.min(100, (selectedPred.nearestWeather.temperature_f - 30) * 1.2), fullMark: 100 },
  ] : [];

  /* Chart data */
  const chartData = sorted.slice(0, 12).map((p) => ({
    label: p.nearestWeather.label,
    rate: p.spreadRate,
    severity: p.severity,
  }));

  const compassLabel = (deg: number) => {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
  };

  if (predictions.length === 0) {
    return (
      <div className="text-center py-12 text-white/30">
        <Flame className="w-8 h-8 mx-auto mb-3 text-white/15" />
        <p className="text-sm">No active fires detected near modeled terrain cells.</p>
        <p className="text-xs mt-1">Predictions will appear when fires are within 30 km of monitored zones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Summary ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Predictions" value={predictions.length} color="text-white/80" />
        <SummaryCard label="Max Spread" value={`${maxSpread} ch/hr`} color="text-red-400" />
        <SummaryCard label="Avg Flame Len" value={`${avgFlame} ft`} color="text-orange-400" />
        <SummaryCard label="Avg Fuel Moisture" value={`${avgMoisture}%`} color={avgMoisture < 8 ? "text-red-400" : "text-amber-400"} />
        <SummaryCard label="Extreme/V.High" value={sevCounts.Extreme + sevCounts["Very High"]} color="text-red-400" />
        <SummaryCard label="High/Moderate" value={sevCounts.High + sevCounts.Moderate} color="text-amber-400" />
      </div>

      {/* ── Model Info ────────────────────────────────── */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/40 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/25" />
        <div>
          <span className="font-semibold text-white/50">Simplified Rothermel Surface Fire Spread Model</span>
          <span className="block mt-0.5">
            R = R₀ × (1 + φ<sub>w</sub> + φ<sub>s</sub>) · Flame length via Byram's fireline intensity ·
            Fuel moisture from Open-Meteo humidity/temperature · Spread direction weighted by wind vector and upslope aspect
          </span>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spread rate bar chart */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            Predicted Spread Rate (chains/hr)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
                formatter={(v: number) => [`${v} ch/hr`, "Spread Rate"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[d.severity]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Factor radar (shows when a row is expanded) */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            {selectedPred ? `Factor Analysis — ${selectedPred.nearestWeather.label}` : "Factor Analysis (select a row)"}
          </h3>
          {selectedPred ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="factor" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <PolarRadiusAxis tick={false} domain={[0, 100]} />
                <Radar dataKey="value" stroke={SEVERITY_COLORS[selectedPred.severity]} fill={SEVERITY_COLORS[selectedPred.severity]} fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-white/20 text-xs">
              Click a row to view factor breakdown
            </div>
          )}
        </div>
      </div>

      {/* ── Prediction Table ──────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-medium w-8" />
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Fuel Type</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("fuel")}>
                <span className="inline-flex items-center gap-1">Moisture <SortIcon col="fuel" /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("spread")}>
                <span className="inline-flex items-center gap-1">Spread Rate <SortIcon col="spread" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("flame")}>
                <span className="inline-flex items-center gap-1">Flame Len <SortIcon col="flame" /></span>
              </th>
              <th className="px-4 py-3 font-medium">Spot Dist</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("severity")}>
                <span className="inline-flex items-center gap-1">Severity <SortIcon col="severity" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sorted.map((p) => (
              <>
                <tr
                  key={p.id}
                  className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${expandedId === p.id ? "bg-white/[0.02]" : ""}`}
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <td className="px-4 py-3 text-white/20">
                    {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-white/70">{p.nearestWeather.label}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{p.fuelType}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs font-semibold ${p.fuelMoisture < 6 ? "text-red-400" : p.fuelMoisture < 10 ? "text-amber-400" : "text-emerald-400"}`}>
                      {p.fuelMoisture}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SpreadBar value={p.spreadRate} max={Math.max(100, maxSpread)} />
                      <span className="font-mono text-xs text-white/60">{p.spreadRate}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-white/50">
                      <ArrowUp className="w-3.5 h-3.5 text-sky-400" style={{ transform: `rotate(${p.spreadDirection}deg)` }} />
                      {compassLabel(p.spreadDirection)} ({p.spreadDirection}°)
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/60">{p.flameLength} ft</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/40">{p.spotPotentialMi} mi</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BG[p.severity]}`}>
                      {p.severity}
                    </span>
                  </td>
                </tr>
                {expandedId === p.id && (
                  <tr key={`${p.id}-detail`} className="bg-white/[0.01]">
                    <td colSpan={9} className="px-8 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
                        <DetailItem icon={<Wind className="w-3 h-3 text-sky-400" />} label="Wind" value={`${p.nearestWeather.wind_speed_mph} mph`} sub={`Dir: ${p.nearestWeather.wind_direction_deg}°`} />
                        <DetailItem icon={<Droplets className="w-3 h-3 text-cyan-400" />} label="Humidity" value={`${p.nearestWeather.humidity_pct}%`} sub={`Temp: ${p.nearestWeather.temperature_f}°F`} />
                        <DetailItem icon={<Mountain className="w-3 h-3 text-amber-400" />} label="Terrain" value={`${p.slope}° slope`} sub={`Aspect: ${p.aspect}° · ${p.elevation} ft`} />
                        <DetailItem icon={<Flame className="w-3 h-3 text-orange-400" />} label="Fuel Load" value={`${p.fuelLoad} t/ac`} sub={`Moisture: ${p.fuelMoisture}%`} />
                        <DetailItem icon={<AlertTriangle className="w-3 h-3 text-red-400" />} label="Fireline Int." value={`${p.firelineIntensity.toLocaleString()} BTU/ft/s`} sub={`FRP: ${p.frp} MW`} />
                        <DetailItem icon={<Flame className="w-3 h-3 text-red-400" />} label="Spread (mph)" value={`${p.spreadRateMph} mph`} sub={`${p.spreadRate} chains/hr`} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-white/20 px-1">
        Predictions use simplified Rothermel model · Real-time weather from Open-Meteo · Terrain/fuel data from regional fuel models
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function SpreadBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? "bg-red-400" : pct > 40 ? "bg-orange-400" : pct > 20 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DetailItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/30 mb-0.5">
        {icon} {label}
      </div>
      <div className="font-semibold text-white/70">{value}</div>
      <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}

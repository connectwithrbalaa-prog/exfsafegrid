import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import TopNav from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Zap, Users, Clock, Activity, X, ChevronDown, Check, AlertTriangle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ── Circuit seed data (mirrors scripts/seed_circuits.sql) ──────────
interface Circuit {
  circuit_id: string;
  circuit_name: string;
  voltage_kv: number;
  utility_name: string;
  county: string;
  hftd_tier: number;
  customer_count: number;
  critical_customers: number;
  length_miles: number;
  lat: number;
  lon: number;
}

const CIRCUITS: Circuit[] = [
  { circuit_id: "SCE-001", circuit_name: "Malibu Canyon 12kV", voltage_kv: 12, utility_name: "SCE", county: "Los Angeles", hftd_tier: 3, customer_count: 3200, critical_customers: 45, length_miles: 18.4, lat: 34.03, lon: -118.68 },
  { circuit_id: "SCE-002", circuit_name: "Santa Ana 66kV", voltage_kv: 66, utility_name: "SCE", county: "Orange", hftd_tier: 2, customer_count: 8500, critical_customers: 120, length_miles: 32.1, lat: 33.74, lon: -117.87 },
  { circuit_id: "SCE-003", circuit_name: "Big Bear 12kV", voltage_kv: 12, utility_name: "SCE", county: "San Bernardino", hftd_tier: 3, customer_count: 1800, critical_customers: 22, length_miles: 24.7, lat: 34.24, lon: -116.91 },
  { circuit_id: "SCE-004", circuit_name: "Banning Pass 115kV", voltage_kv: 115, utility_name: "SCE", county: "Riverside", hftd_tier: 2, customer_count: 6200, critical_customers: 88, length_miles: 41.3, lat: 33.93, lon: -116.88 },
  { circuit_id: "SCE-005", circuit_name: "Newhall Ranch 12kV", voltage_kv: 12, utility_name: "SCE", county: "Los Angeles", hftd_tier: 2, customer_count: 4100, critical_customers: 55, length_miles: 15.6, lat: 34.39, lon: -118.56 },
  { circuit_id: "PGE-001", circuit_name: "Diablo Range 60kV", voltage_kv: 60, utility_name: "PG&E", county: "Alameda", hftd_tier: 2, customer_count: 5400, critical_customers: 72, length_miles: 28.9, lat: 37.52, lon: -121.82 },
  { circuit_id: "PGE-002", circuit_name: "Sonoma Hills 12kV", voltage_kv: 12, utility_name: "PG&E", county: "Sonoma", hftd_tier: 3, customer_count: 2900, critical_customers: 38, length_miles: 22.3, lat: 38.43, lon: -122.53 },
  { circuit_id: "PGE-003", circuit_name: "Paradise Feeder 21kV", voltage_kv: 21, utility_name: "PG&E", county: "Butte", hftd_tier: 3, customer_count: 2100, critical_customers: 65, length_miles: 19.8, lat: 39.76, lon: -121.62 },
  { circuit_id: "PGE-004", circuit_name: "Napa Valley 60kV", voltage_kv: 60, utility_name: "PG&E", county: "Napa", hftd_tier: 2, customer_count: 7200, critical_customers: 95, length_miles: 35.2, lat: 38.58, lon: -122.57 },
  { circuit_id: "PGE-005", circuit_name: "Placerville 12kV", voltage_kv: 12, utility_name: "PG&E", county: "El Dorado", hftd_tier: 3, customer_count: 1500, critical_customers: 18, length_miles: 16.5, lat: 38.73, lon: -120.8 },
  { circuit_id: "PGE-006", circuit_name: "Santa Rosa 115kV", voltage_kv: 115, utility_name: "PG&E", county: "Sonoma", hftd_tier: 2, customer_count: 11200, critical_customers: 145, length_miles: 44.1, lat: 38.44, lon: -122.71 },
  { circuit_id: "PGE-007", circuit_name: "Redding North 60kV", voltage_kv: 60, utility_name: "PG&E", county: "Shasta", hftd_tier: 2, customer_count: 4800, critical_customers: 60, length_miles: 38.7, lat: 40.59, lon: -122.39 },
  { circuit_id: "PGE-008", circuit_name: "Grass Valley 12kV", voltage_kv: 12, utility_name: "PG&E", county: "Nevada", hftd_tier: 3, customer_count: 2200, critical_customers: 30, length_miles: 14.2, lat: 39.22, lon: -121.06 },
  { circuit_id: "SDGE-001", circuit_name: "Ramona 69kV", voltage_kv: 69, utility_name: "SDG&E", county: "San Diego", hftd_tier: 3, customer_count: 3800, critical_customers: 42, length_miles: 26.4, lat: 33.05, lon: -116.87 },
  { circuit_id: "SDGE-002", circuit_name: "Alpine 12kV", voltage_kv: 12, utility_name: "SDG&E", county: "San Diego", hftd_tier: 3, customer_count: 2600, critical_customers: 35, length_miles: 20.1, lat: 32.84, lon: -116.77 },
  { circuit_id: "SDGE-003", circuit_name: "Fallbrook 69kV", voltage_kv: 69, utility_name: "SDG&E", county: "San Diego", hftd_tier: 2, customer_count: 5100, critical_customers: 68, length_miles: 31.8, lat: 33.38, lon: -117.25 },
  { circuit_id: "SDGE-004", circuit_name: "Julian 12kV", voltage_kv: 12, utility_name: "SDG&E", county: "San Diego", hftd_tier: 3, customer_count: 950, critical_customers: 15, length_miles: 12.9, lat: 33.08, lon: -116.6 },
  { circuit_id: "PGE-009", circuit_name: "Ukiah 60kV", voltage_kv: 60, utility_name: "PG&E", county: "Mendocino", hftd_tier: 2, customer_count: 3600, critical_customers: 48, length_miles: 29.5, lat: 39.15, lon: -123.21 },
  { circuit_id: "PGE-010", circuit_name: "Mariposa 12kV", voltage_kv: 12, utility_name: "PG&E", county: "Mariposa", hftd_tier: 3, customer_count: 1200, critical_customers: 20, length_miles: 17.3, lat: 37.48, lon: -119.97 },
  { circuit_id: "SCE-006", circuit_name: "Ventura Hills 66kV", voltage_kv: 66, utility_name: "SCE", county: "Ventura", hftd_tier: 2, customer_count: 6800, critical_customers: 90, length_miles: 27.6, lat: 34.27, lon: -119.23 },
];

const MAPBOX_TOKEN = "pk.eyJ1IjoiZXhmc2FmZWdyaWQiLCJhIjoiY200aWw5Y3RjMGRkODJrcjJ3OHdxOXp4YiJ9.xFKqkNeT3MkJRCFj1vtwcg";

const HORIZONS = [
  { value: "12", label: "12 hours" },
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "72 hours" },
];

// ── Simulation logic ───────────────────────────────────────────
interface SimResult {
  totalCustomers: number;
  residential: number;
  commercial: number;
  critical: number;
  mwLost: number;
  restorationHours: number;
  summary: string;
}

function simulate(selected: Circuit[], horizon: number): SimResult {
  const totalCustomers = selected.reduce((s, c) => s + c.customer_count, 0);
  const critical = selected.reduce((s, c) => s + c.critical_customers, 0);
  const commercial = Math.round(totalCustomers * 0.18);
  const residential = totalCustomers - commercial - critical;

  // MW estimate: ~0.005 MW per customer on average
  const mwLost = Math.round(totalCustomers * 0.005 * 10) / 10;

  // Restoration: base hours by HFTD + horizon factor
  const avgHftd = selected.reduce((s, c) => s + c.hftd_tier, 0) / selected.length;
  const baseFactor = avgHftd >= 3 ? 1.4 : 1.0;
  const restorationHours = Math.round((horizon * 0.6 + selected.length * 1.5) * baseFactor);

  const counties = [...new Set(selected.map((c) => c.county))];
  const summary = `De-energizing ${selected.length} circuit${selected.length > 1 ? "s" : ""} across ${counties.join(", ")} would impact ~${totalCustomers.toLocaleString()} customers (${critical} critical) and shed ${mwLost} MW for an estimated ${restorationHours}-hour restoration window.`;

  return { totalCustomers, residential, commercial, critical, mwLost, restorationHours, summary };
}

// ── Component ──────────────────────────────────────────────────
export default function PspsSimulator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [horizon, setHorizon] = useState("24");
  const [result, setResult] = useState<SimResult | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectedCircuits = useMemo(
    () => CIRCUITS.filter((c) => selectedIds.includes(c.circuit_id)),
    [selectedIds],
  );

  const toggleCircuit = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const runSimulation = () => {
    if (selectedCircuits.length === 0) return;
    setResult(simulate(selectedCircuits, Number(horizon)));
  };

  // ── Map ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-119.4, 36.8],
      zoom: 5.2,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-left");
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Update markers when selection changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    CIRCUITS.forEach((c) => {
      const isSelected = selectedIds.includes(c.circuit_id);
      const el = document.createElement("div");
      el.className = "psps-sim-marker";
      el.style.cssText = `
        width: ${isSelected ? 18 : 10}px;
        height: ${isSelected ? 18 : 10}px;
        border-radius: 50%;
        background: ${isSelected ? "hsl(24 90% 50%)" : "hsl(220 15% 55%)"};
        border: 2px solid ${isSelected ? "hsl(0 0% 100%)" : "transparent"};
        cursor: pointer;
        transition: all 150ms;
        box-shadow: ${isSelected ? "0 0 12px hsl(24 90% 50% / .5)" : "none"};
      `;
      el.addEventListener("click", () => toggleCircuit(c.circuit_id));

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-family:DM Sans,sans-serif;font-size:13px;color:#fff;background:hsl(220 25% 12%);padding:8px 12px;border-radius:8px">
          <strong>${c.circuit_name}</strong><br/>
          ${c.utility_name} · ${c.county}<br/>
          ${c.customer_count.toLocaleString()} customers · HFTD ${c.hftd_tier}
        </div>`
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lon, c.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds to selected
    if (selectedIds.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      selectedCircuits.forEach((c) => bounds.extend([c.lon, c.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 600 });
    }
  }, [selectedIds, selectedCircuits, toggleCircuit]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav variant="dark" />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* ── Left: Map ──────────────────────────────── */}
        <div className="lg:flex-1 h-[45vh] lg:h-auto relative">
          <div ref={mapRef} className="absolute inset-0" />

          {/* floating chip bar of selected circuits */}
          {selectedIds.length > 0 && (
            <div className="absolute top-3 left-12 right-3 flex flex-wrap gap-1.5 z-10">
              {selectedCircuits.map((c) => (
                <Badge
                  key={c.circuit_id}
                  variant="secondary"
                  className="bg-primary/90 text-primary-foreground text-xs gap-1 cursor-pointer hover:bg-primary"
                  onClick={() => toggleCircuit(c.circuit_id)}
                >
                  {c.circuit_id}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Scenario form + results ────────── */}
        <div className="lg:w-[420px] xl:w-[460px] border-l border-border overflow-y-auto p-5 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">PSPS Simulator</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Model a de-energization scenario to estimate customer & grid impact.
            </p>
          </div>

          {/* Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scenario name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Scenario name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Santa Ana wind event Oct 27"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                />
              </div>

              {/* Circuit multi-select */}
              <div className="space-y-1.5">
                <Label>Circuits</Label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      {selectedIds.length === 0
                        ? "Select circuits…"
                        : `${selectedIds.length} circuit${selectedIds.length > 1 ? "s" : ""} selected`}
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0 max-h-64 overflow-y-auto" align="start">
                    {CIRCUITS.map((c) => {
                      const active = selectedIds.includes(c.circuit_id);
                      return (
                        <button
                          key={c.circuit_id}
                          onClick={() => toggleCircuit(c.circuit_id)}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                            active && "bg-primary/10",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                              active
                                ? "bg-primary border-primary"
                                : "border-input",
                            )}
                          >
                            {active && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <span className="flex-1 truncate">
                            {c.circuit_id} — {c.circuit_name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {c.customer_count.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Horizon */}
              <div className="space-y-1.5">
                <Label>Horizon</Label>
                <Select value={horizon} onValueChange={setHorizon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORIZONS.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={runSimulation}
                disabled={selectedIds.length === 0}
              >
                <Zap className="w-4 h-4 mr-1" />
                Run Simulation
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Impact Assessment
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard
                  icon={<Users className="w-4 h-4" />}
                  label="Total Customers"
                  value={result.totalCustomers.toLocaleString()}
                />
                <ResultCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Critical"
                  value={result.critical.toLocaleString()}
                  accent
                />
                <ResultCard
                  icon={<Activity className="w-4 h-4" />}
                  label="MW Lost"
                  value={`${result.mwLost}`}
                />
                <ResultCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Est. Restoration"
                  value={`${result.restorationHours}h`}
                />
              </div>

              {/* Class breakdown */}
              <Card>
                <CardContent className="pt-4 pb-3 space-y-2">
                  <CardDescription className="text-xs uppercase tracking-wide font-semibold">
                    Customer Breakdown
                  </CardDescription>
                  <BarSegment
                    segments={[
                      { label: "Residential", value: result.residential, color: "bg-info" },
                      { label: "Commercial", value: result.commercial, color: "bg-warning" },
                      { label: "Critical", value: result.critical, color: "bg-destructive" },
                    ]}
                    total={result.totalCustomers}
                  />
                </CardContent>
              </Card>

              {/* Summary sentence */}
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function ResultCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-destructive/40" : ""}>
      <CardContent className="pt-4 pb-3 flex items-start gap-3">
        <div
          className={cn(
            "rounded-md p-1.5",
            accent
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BarSegment({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn("h-full", s.color)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full inline-block", s.color)} />
            {s.label}: {s.value.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );
}

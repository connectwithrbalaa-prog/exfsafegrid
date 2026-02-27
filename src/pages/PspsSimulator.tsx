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
  Zap, Users, Clock, Activity, X, ChevronDown, Check, AlertTriangle, Save, Trash2, History, GitCompareArrows, ArrowUp, ArrowDown, Minus, BookOpen,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

import { MAPBOX_STYLE, NAV_CONTROL_POSITION, initMapbox } from "@/lib/mapbox-config";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [scenarioName, setScenarioName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [horizon, setHorizon] = useState("24");
  const [result, setResult] = useState<SimResult | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [playbookName, setPlaybookName] = useState("");
  const [playbookDesc, setPlaybookDesc] = useState("");
  const [playbookTags, setPlaybookTags] = useState("");

  // Load from playbook via sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("playbook_load");
    if (raw) {
      sessionStorage.removeItem("playbook_load");
      try {
        const pb = JSON.parse(raw);
        setScenarioName(pb.name || "");
        setSelectedIds(pb.circuit_ids || []);
        if (pb.baseline_metrics) {
          setResult(pb.baseline_metrics);
        }
      } catch {}
    }
  }, []);

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

  // ── Saved scenarios ────────────────────────────────────────
  const { data: savedScenarios = [] } = useQuery({
    queryKey: ["psps-scenarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psps_scenarios" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No result to save");
      const name = scenarioName.trim() || `Scenario ${new Date().toLocaleDateString()}`;
      const { error } = await supabase.from("psps_scenarios" as any).insert({
        scenario_name: name,
        circuit_ids: selectedIds,
        horizon_hours: Number(horizon),
        total_customers: result.totalCustomers,
        residential: result.residential,
        commercial: result.commercial,
        critical: result.critical,
        mw_lost: result.mwLost,
        restoration_hours: result.restorationHours,
        summary: result.summary,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Scenario saved", description: scenarioName || "Saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["psps-scenarios"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("psps_scenarios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psps-scenarios"] });
    },
  });

  const savePlaybookMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No result");
      const { error } = await supabase.from("psps_playbooks" as any).insert({
        name: playbookName.trim() || scenarioName || `Playbook ${new Date().toLocaleDateString()}`,
        description: playbookDesc.trim() || null,
        circuit_ids: selectedIds,
        baseline_metrics: result,
        tags: playbookTags.split(",").map((t) => t.trim()).filter(Boolean),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Playbook saved", description: playbookName || "Saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["psps-playbooks"] });
      setPlaybookOpen(false);
      setPlaybookName("");
      setPlaybookDesc("");
      setPlaybookTags("");
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const loadScenario = (s: any) => {
    setScenarioName(s.scenario_name);
    setSelectedIds(s.circuit_ids || []);
    setHorizon(String(s.horizon_hours));
    setResult({
      totalCustomers: s.total_customers,
      residential: s.residential,
      commercial: s.commercial,
      critical: s.critical,
      mwLost: Number(s.mw_lost),
      restorationHours: s.restoration_hours,
      summary: s.summary,
    });
  };

  const toggleCompareId = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // replace oldest
      return [...prev, id];
    });
  };

  const compareScenarios = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const a = savedScenarios.find((s: any) => s.id === compareIds[0]);
    const b = savedScenarios.find((s: any) => s.id === compareIds[1]);
    if (!a || !b) return null;
    return [a, b] as [any, any];
  }, [compareIds, savedScenarios]);

  // ── Map ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    initMapbox();
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: MAPBOX_STYLE,
      center: [-119.4, 36.8],
      zoom: 5.2,
    });
    map.addControl(new mapboxgl.NavigationControl(), NAV_CONTROL_POSITION);
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

              {/* Save button */}
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "Saving…" : "Save Scenario"}
              </Button>

              {/* Save as Playbook + nav buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setPlaybookName(scenarioName);
                    setPlaybookOpen(true);
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-1" /> Save as Playbook
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/playbooks")}>
                  Playbooks
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/replay")}>
                  Replay
                </Button>
              </div>
            </div>
          )}

          {/* Playbook save dialog */}
          <Dialog open={playbookOpen} onOpenChange={setPlaybookOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save as Playbook</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pb-name">Playbook Name</Label>
                  <Input id="pb-name" value={playbookName} onChange={(e) => setPlaybookName(e.target.value)} placeholder="e.g. Santa Ana Wind Protocol" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pb-desc">Description</Label>
                  <Textarea id="pb-desc" value={playbookDesc} onChange={(e) => setPlaybookDesc(e.target.value)} placeholder="Describe when to use this playbook…" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pb-tags">Tags (comma-separated)</Label>
                  <Input id="pb-tags" value={playbookTags} onChange={(e) => setPlaybookTags(e.target.value)} placeholder="e.g. santa-ana, high-wind, tier-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlaybookOpen(false)}>Cancel</Button>
                <Button onClick={() => savePlaybookMutation.mutate()} disabled={savePlaybookMutation.isPending}>
                  <BookOpen className="w-4 h-4 mr-1" /> {savePlaybookMutation.isPending ? "Saving…" : "Save Playbook"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Saved Scenarios ─────────────────────── */}
          {savedScenarios.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Saved Scenarios
                </h2>
                {savedScenarios.length >= 2 && (
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
                  >
                    <GitCompareArrows className="w-3.5 h-3.5" />
                    {compareMode ? "Exit Compare" : "Compare"}
                  </Button>
                )}
              </div>

              {compareMode && (
                <p className="text-xs text-muted-foreground">Select 2 scenarios to compare side-by-side.</p>
              )}

              {savedScenarios.map((s: any) => {
                const isCompareSelected = compareIds.includes(s.id);
                return (
                  <Card
                    key={s.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      compareMode && isCompareSelected
                        ? "border-primary ring-1 ring-primary/30"
                        : "hover:border-primary/40",
                    )}
                    onClick={() => compareMode ? toggleCompareId(s.id) : loadScenario(s)}
                  >
                    <CardContent className="pt-3 pb-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          {compareMode && (
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                              isCompareSelected ? "bg-primary border-primary" : "border-input",
                            )}>
                              {isCompareSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground truncate">{s.scenario_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(s.circuit_ids?.length || 0)} circuits · {s.horizon_hours}h horizon · {new Date(s.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {!compareMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {/* Detail metrics */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Customers</span>
                          <span className="font-semibold text-foreground">{(s.total_customers || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MW Lost</span>
                          <span className="font-semibold text-foreground">{Number(s.mw_lost || 0).toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Residential</span>
                          <span className="font-medium text-foreground">{(s.residential || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Commercial</span>
                          <span className="font-medium text-foreground">{(s.commercial || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Critical</span>
                          <span className="font-semibold text-destructive">{(s.critical || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Restoration</span>
                          <span className="font-semibold text-foreground">{s.restoration_hours || 0}h</span>
                        </div>
                      </div>
                      {s.summary && (
                        <p className="text-[11px] text-muted-foreground italic border-t border-border pt-1.5 mt-1">{s.summary}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Comparison panel */}
              {compareMode && compareScenarios && (
                <ComparisonPanel a={compareScenarios[0]} b={compareScenarios[1]} />
              )}
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

// ── Delta helper ──────────────────────────────────────────────
function DeltaIndicator({ a, b, unit = "", invert = false }: { a: number; b: number; unit?: string; invert?: boolean }) {
  const diff = b - a;
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />0{unit}</span>;
  const isUp = diff > 0;
  const isBad = invert ? !isUp : isUp;
  return (
    <span className={cn("text-xs font-medium flex items-center gap-0.5", isBad ? "text-destructive" : "text-accent-foreground")}>
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{diff.toLocaleString()}{unit}
    </span>
  );
}

// ── Comparison Panel ──────────────────────────────────────────
function ComparisonPanel({ a, b }: { a: any; b: any }) {
  const metrics = [
    { label: "Total Customers", keyA: a.total_customers, keyB: b.total_customers, unit: "" },
    { label: "Critical", keyA: a.critical, keyB: b.critical, unit: "" },
    { label: "Residential", keyA: a.residential, keyB: b.residential, unit: "" },
    { label: "Commercial", keyA: a.commercial, keyB: b.commercial, unit: "" },
    { label: "MW Lost", keyA: Number(a.mw_lost), keyB: Number(b.mw_lost), unit: " MW" },
    { label: "Restoration", keyA: a.restoration_hours, keyB: b.restoration_hours, unit: "h" },
  ];

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitCompareArrows className="w-4 h-4" /> Scenario Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 pb-3">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-2 pb-2 border-b border-border text-xs font-semibold text-muted-foreground">
          <span>Metric</span>
          <span className="text-right truncate" title={a.scenario_name}>{a.scenario_name}</span>
          <span className="text-right truncate" title={b.scenario_name}>{b.scenario_name}</span>
          <span className="text-right">Delta</span>
        </div>

        {metrics.map((m) => (
          <div key={m.label} className="grid grid-cols-4 gap-2 py-1.5 border-b border-border/50 last:border-0 text-sm">
            <span className="text-muted-foreground text-xs">{m.label}</span>
            <span className="text-right font-medium text-foreground">{m.keyA.toLocaleString()}{m.unit}</span>
            <span className="text-right font-medium text-foreground">{m.keyB.toLocaleString()}{m.unit}</span>
            <span className="text-right"><DeltaIndicator a={m.keyA} b={m.keyB} unit={m.unit} /></span>
          </div>
        ))}

        {/* Circuits diff */}
        <div className="pt-2 space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">Circuit differences</p>
          {(() => {
            const aIds: string[] = a.circuit_ids || [];
            const bIds: string[] = b.circuit_ids || [];
            const bSet = new Set(bIds);
            const aSet = new Set(aIds);
            const onlyA = aIds.filter((x) => !bSet.has(x));
            const onlyB = bIds.filter((x) => !aSet.has(x));
            const shared = aIds.filter((x) => bSet.has(x));
            return (
              <div className="text-xs space-y-0.5">
                {shared.length > 0 && <p className="text-muted-foreground">Shared: {shared.join(", ")}</p>}
                {onlyA.length > 0 && <p className="text-destructive">Only in {a.scenario_name}: {onlyA.join(", ")}</p>}
                {onlyB.length > 0 && <p className="text-primary">Only in {b.scenario_name}: {onlyB.join(", ")}</p>}
              </div>
            );
          })()}
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

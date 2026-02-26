/**
 * PspsStatus — Public PSPS Status Page (no login required)
 * Mobile-first: ZIP input → simple status card → expandable details
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, RefreshCw, Search, MapPin, Clock, AlertTriangle,
  CheckCircle2, Flame, Phone, ChevronDown, ChevronUp,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface ZipStatus {
  zip_code: string;
  region: string;
  psps_phase: string;
  current_outage_status: string;
  restoration_timer: string;
  nearest_crc_location: string;
  grid_stress_level: string;
  customerCount: number;
}

type GlobalStatus = "Normal" | "Watch" | "Warning" | "PSPS Active";

const GLOBAL_STYLE: Record<GlobalStatus, { text: string; banner: string; icon: React.ReactNode }> = {
  Normal:        { text: "text-emerald-600 dark:text-emerald-400", banner: "bg-emerald-50 dark:bg-emerald-900/20", icon: <CheckCircle2 className="w-5 h-5" /> },
  Watch:         { text: "text-amber-600 dark:text-amber-400", banner: "bg-amber-50 dark:bg-amber-900/20", icon: <Clock className="w-5 h-5" /> },
  Warning:       { text: "text-orange-600 dark:text-orange-400", banner: "bg-orange-50 dark:bg-orange-900/20", icon: <AlertTriangle className="w-5 h-5" /> },
  "PSPS Active": { text: "text-red-600 dark:text-red-400", banner: "bg-red-50 dark:bg-red-900/20", icon: <Flame className="w-5 h-5" /> },
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  Watch:     { label: "Watch", color: "text-amber-500" },
  Warning:   { label: "Warning", color: "text-orange-500" },
  "Phase 1": { label: "Phase 1 — Pre-event", color: "text-orange-500" },
  "Phase 2": { label: "Phase 2 — Pending", color: "text-red-500" },
  "Phase 3": { label: "Phase 3 — De-energized", color: "text-red-600" },
  Restored:  { label: "Restored", color: "text-emerald-500" },
};

export default function PspsStatus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [zipInput, setZipInput] = useState(searchParams.get("zip") || "");
  const [zipStatuses, setZipStatuses] = useState<ZipStatus[]>([]);
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>("Normal");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchResult, setSearchResult] = useState<ZipStatus | null | "not-found">(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [allAreasOpen, setAllAreasOpen] = useState(false);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("zip_code, region, psps_phase, current_outage_status, restoration_timer, nearest_crc_location, grid_stress_level");

      if (data && data.length > 0) {
        const byZip: Record<string, ZipStatus> = {};
        for (const c of data as any[]) {
          if (!byZip[c.zip_code]) byZip[c.zip_code] = { ...c, customerCount: 0 };
          byZip[c.zip_code].customerCount++;
          if (c.psps_phase && c.psps_phase !== "Restored" && byZip[c.zip_code].psps_phase === "Restored") {
            byZip[c.zip_code].psps_phase = c.psps_phase;
          }
        }
        const statuses = Object.values(byZip).sort((a, b) => a.zip_code.localeCompare(b.zip_code));
        setZipStatuses(statuses);

        const phases = statuses.map((s) => s.psps_phase);
        if (phases.some((p) => p?.includes("Phase 3"))) setGlobalStatus("PSPS Active");
        else if (phases.some((p) => p?.includes("Phase 2") || p?.includes("Phase 1"))) setGlobalStatus("Warning");
        else if (phases.some((p) => p === "Watch")) setGlobalStatus("Watch");
        else setGlobalStatus("Normal");
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch status", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 60000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  useEffect(() => {
    const zip = searchParams.get("zip");
    if (zip && zipStatuses.length > 0) {
      const found = zipStatuses.find((s) => s.zip_code === zip);
      setSearchResult(found || "not-found");
    }
  }, [searchParams, zipStatuses]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipInput.trim()) return;
    setSearchParams({ zip: zipInput.trim() });
    const found = zipStatuses.find((s) => s.zip_code === zipInput.trim());
    setSearchResult(found || "not-found");
    setDetailsOpen(false);
  };

  const gcfg = GLOBAL_STYLE[globalStatus];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TopNav />

      {/* Global status — compact on mobile */}
      <div className={`border-b ${gcfg.banner}`}>
        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={gcfg.text}>{gcfg.icon}</span>
            <div>
              <h2 className={`text-sm sm:text-base font-bold ${gcfg.text}`}>
                {isMobile ? globalStatus : `Grid Status: ${globalStatus}`}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
                {globalStatus === "Normal"
                  ? "All circuits operating normally."
                  : globalStatus === "PSPS Active"
                  ? "Active PSPS de-energization in progress."
                  : "Elevated fire weather conditions."}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            {lastUpdated && (
              <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 justify-end">
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {loading ? "…" : lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Header — simplified on mobile */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold">ExfSafeGrid Status</h1>
              <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Live PSPS Info</p>
            </div>
          </div>
          <a href="tel:1-800-555-0199" className="flex items-center gap-1 text-[11px] sm:text-xs text-blue-600 dark:text-blue-400">
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1-800-555-0199</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ZIP Search — primary action */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-2 sm:mb-3">Check Your ZIP Code</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                placeholder="ZIP code (e.g. 95370)"
                maxLength={5}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Check</span>
            </button>
          </form>

          {/* Simple status card result */}
          {searchResult && searchResult !== "not-found" && (
            <div className="mt-4 space-y-3">
              {/* Primary info */}
              <div className="p-4 rounded-lg border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-sm">ZIP {searchResult.zip_code}</span>
                  <span className="text-xs text-gray-400">· {searchResult.region}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatusField
                    label="Status"
                    value={searchResult.current_outage_status || "Normal"}
                    valueColor={searchResult.current_outage_status === "Active" ? "text-red-500" : "text-emerald-500"}
                  />
                  <StatusField
                    label="PSPS Phase"
                    value={PHASE_LABELS[searchResult.psps_phase]?.label || searchResult.psps_phase || "Restored"}
                    valueColor={PHASE_LABELS[searchResult.psps_phase]?.color || "text-emerald-500"}
                  />
                  <StatusField label="Est. Restoration" value={searchResult.restoration_timer || "N/A"} />
                  <StatusField label="Nearest CRC" value={searchResult.nearest_crc_location || "N/A"} />
                </div>
              </div>

              {/* Expandable extra details */}
              <button
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {detailsOpen ? "Hide details" : "More details"}
                {detailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {detailsOpen && (
                <div className="p-4 rounded-lg border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] space-y-2">
                  <StatusField label="Grid Stress" value={searchResult.grid_stress_level || "Normal"} />
                  <StatusField label="Customers Affected" value={String(searchResult.customerCount)} />
                  <p className="text-[11px] text-gray-400 pt-1">
                    For emergencies, call <strong>1-800-555-0199</strong>. For downed lines, call 911.
                  </p>
                </div>
              )}
            </div>
          )}

          {searchResult === "not-found" && (
            <p className="mt-3 text-sm text-amber-500">ZIP {zipInput} not found in our service territory.</p>
          )}
        </div>

        {/* All Service Areas — collapsible on mobile, always open on desktop */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
          <button
            onClick={() => setAllAreasOpen(!allAreasOpen)}
            className="w-full px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between"
          >
            <h2 className="text-sm font-semibold">All Service Areas</h2>
            {isMobile && (
              <span className="text-gray-400">
                {allAreasOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            )}
          </button>
          {(allAreasOpen || !isMobile) && (
            <>
              {loading ? (
                <div className="py-10 flex justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                  {zipStatuses.map((s) => {
                    const phaseCfg = PHASE_LABELS[s.psps_phase] || { label: s.psps_phase || "Normal", color: "text-emerald-500" };
                    return (
                      <div key={s.zip_code} className="px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-300 dark:text-white/20" />
                          <span className="text-sm font-medium">{s.zip_code}</span>
                          <span className="text-xs text-gray-400 hidden sm:inline">{s.region}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 text-xs">
                          <span className={`font-medium ${phaseCfg.color}`}>{phaseCfg.label}</span>
                          {s.restoration_timer && s.psps_phase !== "Restored" && (
                            <span className="text-gray-400 items-center gap-1 hidden sm:flex">
                              <Clock className="w-3 h-3" />
                              {s.restoration_timer}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center pb-2">
          Emergency: <strong>1-800-555-0199</strong> · Downed lines: call 911
        </p>
      </main>
    </div>
  );
}

function StatusField({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${valueColor || ""}`}>{value}</p>
    </div>
  );
}

/**
 * PspsStatus — Public PSPS Status Page (no login required)
 *
 * Technical approach:
 * - Public-facing page at /status — no auth required
 * - Fetches live PSPS state from Supabase (customers table) and Red Flag status
 * - Refreshes every 60 seconds automatically
 * - ZIP-code lookup: visitors type their ZIP to see their area's status
 * - Shows: outage status, PSPS phase, estimated restoration, CRC locations
 * - Dark/light mode support via CSS variables
 * - Shareable URL: /status?zip=95370
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, RefreshCw, Search, MapPin, Clock, AlertTriangle, CheckCircle2, Flame, Phone } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import TopNav from "@/components/TopNav";

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

const GLOBAL_STYLE: Record<GlobalStatus, { bg: string; text: string; banner: string; icon: React.ReactNode }> = {
  Normal:      { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", banner: "bg-emerald-50 dark:bg-emerald-900/20", icon: <CheckCircle2 className="w-5 h-5" /> },
  Watch:       { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-600 dark:text-amber-400", banner: "bg-amber-50 dark:bg-amber-900/20", icon: <Clock className="w-5 h-5" /> },
  Warning:     { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-600 dark:text-orange-400", banner: "bg-orange-50 dark:bg-orange-900/20", icon: <AlertTriangle className="w-5 h-5" /> },
  "PSPS Active": { bg: "bg-red-500/10 border-red-500/30", text: "text-red-600 dark:text-red-400", banner: "bg-red-50 dark:bg-red-900/20", icon: <Flame className="w-5 h-5" /> },
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  "Watch":     { label: "Watch", color: "text-amber-500" },
  "Warning":   { label: "Warning", color: "text-orange-500" },
  "Phase 1":   { label: "Phase 1 — Pre-event", color: "text-orange-500" },
  "Phase 2":   { label: "Phase 2 — Pending", color: "text-red-500" },
  "Phase 3":   { label: "Phase 3 — De-energized", color: "text-red-600" },
  "Restored":  { label: "Restored", color: "text-emerald-500" },
};

export default function PspsStatus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [zipInput, setZipInput] = useState(searchParams.get("zip") || "");
  const [zipStatuses, setZipStatuses] = useState<ZipStatus[]>([]);
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>("Normal");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ZipStatus | null | "not-found">(null);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("zip_code, region, psps_phase, current_outage_status, restoration_timer, nearest_crc_location, grid_stress_level");

      if (data && data.length > 0) {
        // Aggregate by ZIP
        const byZip: Record<string, ZipStatus> = {};
        for (const c of data as any[]) {
          if (!byZip[c.zip_code]) {
            byZip[c.zip_code] = { ...c, customerCount: 0 };
          }
          byZip[c.zip_code].customerCount++;
          // If any customer in ZIP has active PSPS, elevate the ZIP
          if (c.psps_phase && c.psps_phase !== "Restored" && byZip[c.zip_code].psps_phase === "Restored") {
            byZip[c.zip_code].psps_phase = c.psps_phase;
          }
        }
        const statuses = Object.values(byZip).sort((a, b) => a.zip_code.localeCompare(b.zip_code));
        setZipStatuses(statuses);

        // Derive global status
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

  // Auto-search if zip in URL
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
    setSearching(true);
    setSearchParams({ zip: zipInput.trim() });
    const found = zipStatuses.find((s) => s.zip_code === zipInput.trim());
    setSearchResult(found || "not-found");
    setSearching(false);
  };

  const gcfg = GLOBAL_STYLE[globalStatus];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TopNav />
      {/* Global status banner */}
      <div className={`border-b ${gcfg.banner}`}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={gcfg.text}>{gcfg.icon}</span>
            <div>
              <h2 className={`text-base font-bold ${gcfg.text}`}>
                Grid Status: {globalStatus}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {globalStatus === "Normal"
                  ? "All circuits operating normally. No PSPS events active."
                  : globalStatus === "PSPS Active"
                  ? "Active PSPS de-energization in progress. Check your ZIP below."
                  : "Elevated fire weather conditions. Monitor for PSPS updates."}
              </p>
            </div>
          </div>
          <div className="text-right">
            {lastUpdated && (
              <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Updating…" : `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            )}
            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">Auto-refreshes every 60s</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold">ExfSafeGrid — Service Status</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Live PSPS & Outage Information</p>
            </div>
          </div>
          <a
            href="tel:1-800-555-0199"
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Phone className="w-3.5 h-3.5" />
            1-800-555-0199
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ZIP search */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-5">
          <h2 className="text-sm font-semibold mb-3">Check Your Address</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                placeholder="Enter ZIP code (e.g. 95370)"
                maxLength={5}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={searching || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Search className="w-4 h-4" />
              Check
            </button>
          </form>

          {/* Search result */}
          {searchResult && searchResult !== "not-found" && (
            <div className="mt-4 p-4 rounded-lg border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">ZIP {searchResult.zip_code}</span>
                  <span className="text-sm text-gray-400">· {searchResult.region}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Outage Status</p>
                  <p className={`font-medium ${searchResult.current_outage_status === "Active" ? "text-red-500" : "text-emerald-500"}`}>
                    {searchResult.current_outage_status || "No Outage"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">PSPS Phase</p>
                  <p className={`font-medium ${PHASE_LABELS[searchResult.psps_phase]?.color || "text-gray-500"}`}>
                    {PHASE_LABELS[searchResult.psps_phase]?.label || searchResult.psps_phase || "Restored"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Est. Restoration</p>
                  <p className="font-medium">{searchResult.restoration_timer || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Nearest CRC</p>
                  <p className="font-medium text-sm">{searchResult.nearest_crc_location || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
          {searchResult === "not-found" && (
            <p className="mt-3 text-sm text-amber-500">ZIP code {zipInput} not found in our service territory.</p>
          )}
        </div>

        {/* ZIP status table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold">All Service Areas</h2>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {zipStatuses.map((s) => {
                const phaseCfg = PHASE_LABELS[s.psps_phase] || { label: s.psps_phase || "Normal", color: "text-emerald-500" };
                return (
                  <div key={s.zip_code} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-3.5 h-3.5 text-gray-300 dark:text-white/20" />
                      <div>
                        <span className="text-sm font-medium">{s.zip_code}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.region}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-medium text-xs ${phaseCfg.color}`}>{phaseCfg.label}</span>
                      {s.restoration_timer && s.psps_phase !== "Restored" && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
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
        </div>

        <p className="text-xs text-gray-400 text-center">
          For emergencies, call <strong>1-800-555-0199</strong>.
          For downed lines, call 911 immediately.
        </p>
      </main>
    </div>
  );
}

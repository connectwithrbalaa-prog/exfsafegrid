/**
 * BackendOpsPanel — Shows live backend data: briefings, PSPS watchlist,
 * circuit ignition risk, ingestion status, and management controls.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import DemoBadge from "@/components/DemoBadge";
import {
  useBackendHealth,
  useBriefing,
  useGenerateBriefing,
  usePspsWatchlist,
  useGenerateWatchlist,
  useCircuitIgnitionRisk,
  usePsaRisk,
  useIngestionStatus,
  useTrainModels,
  useScoreModels,
  useTriggerIngestion,
  useActiveIncidents,
} from "@/hooks/use-backend-data";
import {
  Activity, AlertTriangle, CheckCircle, Loader2, RefreshCw,
  Server, Zap, FileText, Shield, Database, Play, Download,
} from "lucide-react";
import { downloadCsv, formatCircuitRiskCsv, formatPsaRiskCsv } from "@/lib/csv-export";
import { toast } from "sonner";

/** Extract the best displayable text from a briefing/watchlist response */
function extractNarrative(data: any): string | null {
  if (!data) return null;
  // Try known text fields
  for (const key of ["narrative", "summary", "markdown_text", "text", "content"]) {
    if (typeof data[key] === "string" && data[key].trim()) return data[key];
  }
  // If the entire response is a string
  if (typeof data === "string") return data;
  return null;
}

export default function BackendOpsPanel() {
  const health = useBackendHealth();
  const briefing = useBriefing();
  const watchlist = usePspsWatchlist();
  const circuitRisk = useCircuitIgnitionRisk({ horizon_hours: 24, limit: 10 });
  const psaRisk = usePsaRisk({ limit: 10 });
  const ingestion = useIngestionStatus();
  const incidents = useActiveIncidents({ limit: 10 });
  const genBriefing = useGenerateBriefing();
  const genWatchlist = useGenerateWatchlist();
  const trainMut = useTrainModels();
  const scoreMut = useScoreModels();
  const triggerMut = useTriggerIngestion();

  const [activeSection, setActiveSection] = useState<"briefing" | "watchlist" | "risk" | "ingestion" | "incidents">("briefing");

  const backendOnline = health.isSuccess;
  const backendError = health.isError;

  return (
    <div className="space-y-4">
      {/* Backend Status */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${
        backendOnline
          ? "border-emerald-500/30 bg-emerald-500/5"
          : backendError
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}>
        {health.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white/40" />
        ) : backendOnline ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        )}
        <div className="flex-1">
          <span className="text-xs font-semibold">
            {backendOnline ? "Backend Online" : backendError ? "Backend Unreachable" : "Checking..."}
          </span>
          {backendOnline && health.data && (
            <span className="text-[10px] text-white/30 ml-2">
              v{health.data.version} · {health.data.service}
            </span>
          )}
        </div>
        <button
          onClick={() => health.refetch()}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {!backendOnline && (
        <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
          <p>The FastAPI backend is not reachable. Make sure it's running and BACKEND_API_URL is set correctly.</p>
          <p className="mt-1 text-white/20">All panels below will show cached/mock data until the backend is online.</p>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "briefing", label: "Daily Briefing", icon: FileText },
          { key: "watchlist", label: "PSPS Watchlist", icon: Shield },
          { key: "risk", label: "Circuit Risk", icon: Zap },
          { key: "incidents", label: "Live Incidents", icon: Activity },
          { key: "ingestion", label: "System Ops", icon: Database },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              activeSection === key
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Briefing */}
      {activeSection === "briefing" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Daily Operations Briefing
            </h3>
            <button
              onClick={() => {
                genBriefing.mutate({}, {
                  onSuccess: () => toast.success("Briefing generated"),
                  onError: (e) => toast.error(`Failed: ${e.message}`),
                });
              }}
              disabled={genBriefing.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
            >
              {genBriefing.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Generate New
            </button>
          </div>
          {briefing.isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading briefing…
            </div>
          ) : briefing.isError ? (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
              No briefing available. Click "Generate New" to create one.
            </div>
          ) : briefing.data ? (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] space-y-2">
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>Date: {briefing.data.briefing_date}</span>
                {briefing.data.model_name && <span>Model: {briefing.data.model_name}</span>}
              </div>
              <div className="prose prose-invert prose-sm max-w-none max-h-96 overflow-y-auto text-white/80">
                <ReactMarkdown>{extractNarrative(briefing.data) ?? JSON.stringify(briefing.data, null, 2)}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Watchlist */}
      {activeSection === "watchlist" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              PSPS Watchlist
            </h3>
            <button
              onClick={() => {
                genWatchlist.mutate({}, {
                  onSuccess: () => toast.success("Watchlist generated"),
                  onError: (e) => toast.error(`Failed: ${e.message}`),
                });
              }}
              disabled={genWatchlist.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
            >
              {genWatchlist.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Generate
            </button>
          </div>
          {watchlist.isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading watchlist…
            </div>
          ) : watchlist.isError ? (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
              No watchlist available. Click "Generate" to create one.
            </div>
          ) : watchlist.data ? (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] prose prose-invert prose-sm max-w-none max-h-96 overflow-y-auto text-white/80">
              <ReactMarkdown>{extractNarrative(watchlist.data) ?? JSON.stringify(watchlist.data, null, 2)}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      )}

      {/* Circuit Risk */}
      {activeSection === "risk" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              Circuit Ignition Risk (24h)
              {circuitRisk.data?.demo && <DemoBadge />}
            </h3>
            {circuitRisk.data?.results?.length > 0 && (
              <button
                onClick={() => downloadCsv(formatCircuitRiskCsv(circuitRisk.data.results), `circuit-ignition-risk-24h.csv`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            )}
          </div>
          {circuitRisk.isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : circuitRisk.data?.results?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                    <th className="px-3 py-2">Circuit</th>
                    <th className="px-3 py-2">PSA</th>
                    <th className="px-3 py-2">Prob Spike</th>
                    <th className="px-3 py-2">Risk Band</th>
                    <th className="px-3 py-2">HFTD</th>
                    <th className="px-3 py-2">Customers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {circuitRisk.data.results.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono">{r.circuit_id}</td>
                      <td className="px-3 py-2">{r.psa_id}</td>
                      <td className="px-3 py-2 font-mono">{(r.prob_spike * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.risk_band === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                          r.risk_band === "HIGH" ? "bg-orange-500/15 text-orange-300" :
                          r.risk_band === "ELEVATED" ? "bg-amber-500/15 text-amber-300" :
                          "bg-emerald-500/15 text-emerald-300"
                        }`}>{r.risk_band}</span>
                      </td>
                      <td className="px-3 py-2">{r.hftd_tier || "—"}</td>
                      <td className="px-3 py-2">{r.customer_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
              No circuit risk data. Run model scoring first.
            </div>
          )}

          {/* PSA Risk Summary */}
          <div className="flex items-center justify-between mt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              PSA Activity Risk (Month 1)
              {psaRisk.data?.demo && <DemoBadge />}
            </h3>
            {psaRisk.data?.results?.length > 0 && (
              <button
                onClick={() => downloadCsv(formatPsaRiskCsv(psaRisk.data.results), `psa-activity-risk-month1.csv`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            )}
          </div>
          {psaRisk.isLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : psaRisk.data?.results?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {psaRisk.data.results.slice(0, 10).map((r: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <div className="text-[10px] text-white/30 font-mono">{r.circuit_id}</div>
                  <div className="text-lg font-bold tabular-nums">{(r.prob_above_normal * 100).toFixed(0)}%</div>
                  <span className={`text-[10px] font-semibold ${
                    r.risk_bucket === "CRITICAL" ? "text-red-400" :
                    r.risk_bucket === "HIGH" ? "text-orange-400" :
                    r.risk_bucket === "ELEVATED" ? "text-amber-400" :
                    "text-emerald-400"
                  }`}>{r.risk_bucket}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
              No PSA risk data available.
            </div>
          )}
        </div>
      )}

      {/* Live Incidents from Backend */}
      {activeSection === "incidents" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            Active Incidents (NIFC)
          </h3>
          {incidents.isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : incidents.data?.incidents?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                    <th className="px-3 py-2">Incident</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2">Acres</th>
                    <th className="px-3 py-2">Containment</th>
                    <th className="px-3 py-2">Cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {incidents.data.incidents.map((inc: any, i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-medium">{inc.incident_name}</td>
                      <td className="px-3 py-2">{inc.state}</td>
                      <td className="px-3 py-2 font-mono">{inc.acres_burned?.toLocaleString() ?? "—"}</td>
                      <td className="px-3 py-2">{inc.containment_pct != null ? `${inc.containment_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-white/50">{inc.cause || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
              No active incidents from backend.
            </div>
          )}
        </div>
      )}

      {/* System Ops */}
      {activeSection === "ingestion" && (
        <div className="space-y-4">
          {/* Ingestion Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Ingestion Status (last 24h)
            </h3>
            {ingestion.isLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : ingestion.data?.sources?.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ingestion.data.sources.map((s: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    <div className="text-xs font-semibold">{s.source}</div>
                    <div className="text-[10px] text-white/30 mt-1">
                      Fetched: {s.total_fetched} · Inserted: {s.total_inserted}
                      {s.error_count > 0 && <span className="text-red-400 ml-1">· {s.error_count} errors</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
                No ingestion data available.
              </div>
            )}
          </div>

          {/* Management Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-white/60" />
              Management Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => trainMut.mutate({}, {
                  onSuccess: () => toast.success("Models trained"),
                  onError: (e) => toast.error(e.message),
                })}
                disabled={trainMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
              >
                {trainMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Train All Models
              </button>
              <button
                onClick={() => trainMut.mutate({ model: "fire_spread", synthetic: true }, {
                  onSuccess: () => toast.success("Fire Spread model trained (synthetic)"),
                  onError: (e) => toast.error(e.message),
                })}
                disabled={trainMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/20 hover:bg-orange-500/20 transition-colors disabled:opacity-40"
              >
                {trainMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Train Fire Spread
              </button>
              <button
                onClick={() => scoreMut.mutate({}, {
                  onSuccess: () => toast.success("Models scored"),
                  onError: (e) => toast.error(e.message),
                })}
                disabled={scoreMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
              >
                {scoreMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Score Circuits
              </button>
              {["incidents", "perimeters", "outlooks", "raws"].map((src) => (
                <button
                  key={src}
                  onClick={() => triggerMut.mutate(src, {
                    onSuccess: () => toast.success(`${src} ingestion triggered`),
                    onError: (e) => toast.error(e.message),
                  })}
                  disabled={triggerMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                >
                  <RefreshCw className="w-3 h-3" />
                  Ingest {src}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

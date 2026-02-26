/**
 * DailyBriefingPanel — renders the Claude-generated ops briefing as a
 * formatted document rather than raw JSON/markdown text.
 *
 * Fetches markdown_text from GET /briefing and converts it to readable HTML.
 * Styles live in src/index.css (.briefing-doc).
 */

import { useState } from "react";
import { useDailyBriefing } from "@/hooks/use-api";
import { renderMarkdown } from "@/lib/render-markdown";
import { RefreshCw, FileText, Calendar, Cpu, AlertCircle } from "lucide-react";

/* ── Component ────────────────────────────────────────────────── */

export default function DailyBriefingPanel() {
  const [dateInput, setDateInput] = useState<string>("");
  const [queriedDate, setQueriedDate] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, error, refetch } = useDailyBriefing(queriedDate);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDateInput(v);
    setQueriedDate(v || undefined);
  };

  const bodyHtml = data?.markdown_text ? renderMarkdown(data.markdown_text) : "";

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-white/40" />
          <input
            type="date"
            value={dateInput}
            onChange={handleDateChange}
            className="bg-white/[0.05] border border-white/[0.12] rounded-md px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            placeholder="Today"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.05] border border-white/[0.10] text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {data && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {data.model_used}
            </span>
            <span>{data.tokens_used?.toLocaleString()} tokens</span>
            <span>{new Date(data.created_at).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Content area */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-white/30">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading briefing…
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">No briefing available</p>
            <p className="text-xs text-amber-400/70 mt-1">
              {(error as Error)?.message?.includes("404")
                ? "No briefing has been generated for this date yet. Use POST /briefing/generate to create one."
                : String((error as Error)?.message ?? "Failed to load briefing.")}
            </p>
          </div>
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {/* Document header strip */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Daily Ops Briefing — {data.briefing_date}
            </span>
          </div>

          {/* Rendered markdown body */}
          <div
            className="briefing-doc px-8 py-6"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      )}

    </div>
  );
}

/**
 * DailyBriefingPanel — renders the Claude-generated ops briefing as a
 * formatted document rather than raw JSON/markdown text.
 *
 * Fetches markdown_text from GET /briefing and converts it to readable HTML
 * using a lightweight inline renderer — no external markdown library needed.
 */

import { useState } from "react";
import { useDailyBriefing } from "@/hooks/use-api";
import { RefreshCw, FileText, Calendar, Cpu, AlertCircle } from "lucide-react";

/* ── Simple markdown → HTML converter ───────────────────────── */

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList === "ul") { out.push("</ul>"); inList = null; }
    if (inList === "ol") { out.push("</ol>"); inList = null; }
  };

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (inList !== "ol") { closeList(); out.push("<ol>"); inList = "ol"; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ""))}</li>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (inList !== "ul") { closeList(); out.push("<ul>"); inList = "ul"; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line === "---" || line === "***") {
      closeList();
      out.push("<hr/>");
    } else if (line.trim() === "") {
      closeList();
      out.push("<br/>");
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

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

  const bodyHtml = data?.markdown_text ? mdToHtml(data.markdown_text) : "";

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

      <style>{`
        .briefing-doc { font-family: Georgia, 'Times New Roman', serif; color: rgba(255,255,255,0.88); line-height: 1.75; max-width: 820px; }
        .briefing-doc h1 { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; border-bottom: 2px solid rgba(220,38,38,0.5); padding-bottom: 8px; margin: 0 0 1rem; }
        .briefing-doc h2 { font-size: 1.05rem; font-weight: 700; color: #bfdbfe; border-left: 3px solid rgba(220,38,38,0.7); padding-left: 10px; margin: 1.6rem 0 0.6rem; }
        .briefing-doc h3 { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; margin: 1.2rem 0 0.4rem; }
        .briefing-doc p { margin: 0.4rem 0; font-size: 0.9rem; }
        .briefing-doc ul, .briefing-doc ol { padding-left: 1.5rem; margin: 0.5rem 0; }
        .briefing-doc li { margin-bottom: 0.35rem; font-size: 0.9rem; }
        .briefing-doc strong { color: #f1f5f9; font-weight: 700; }
        .briefing-doc em { color: rgba(255,255,255,0.45); font-style: italic; font-size: 0.82rem; }
        .briefing-doc code { background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; font-family: monospace; font-size: 0.82rem; color: #93c5fd; }
        .briefing-doc hr { border: none; border-top: 1px solid rgba(255,255,255,0.10); margin: 1.5rem 0; }
        .briefing-doc br { display: block; margin: 0.2rem 0; content: ''; }
      `}</style>
    </div>
  );
}

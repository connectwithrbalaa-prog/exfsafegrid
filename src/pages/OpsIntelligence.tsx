import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, RefreshCw, AlertTriangle, FileText, Loader2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import RiskBadge from "@/components/RiskBadge";
import { useDailyBriefing, usePspsWatchlist } from "@/hooks/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { renderMarkdown } from "@/lib/render-markdown";

/* ── Shared ────────────────────────────────────────────────── */
function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
      </Button>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/* ── Daily Briefing Tab ────────────────────────────────────── */
function DailyBriefingTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useDailyBriefing();
  const is404 = isError && error instanceof ApiError && error.status === 404;

  const generate = useMutation({
    mutationFn: (overwrite: boolean) =>
      apiFetch("/briefing/generate", {
        method: "POST",
        body: JSON.stringify({ overwrite }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing"] }),
  });

  if (isLoading) return <ContentSkeleton />;
  if (is404 || (!isLoading && !data)) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No briefing has been generated for today.</p>
        <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}>
          {generate.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            "Generate Today's Briefing"
          )}
        </Button>
      </div>
    );
  }
  if (isError) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Date: <strong className="text-foreground">{data!.briefing_date}</strong></span>
        {data!.model_used && <span>Model: {data!.model_used}</span>}
        {data!.tokens_used != null && <span>Tokens: {data!.tokens_used.toLocaleString()}</span>}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => generate.mutate(true)} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate New Briefing"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Rendered markdown */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-6"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(data!.markdown_text) }}
      />
    </div>
  );
}

/* ── PSPS Watchlist Tab ────────────────────────────────────── */
const HORIZONS = ["24h", "48h", "72h"] as const;
type Horizon = (typeof HORIZONS)[number];

function PspsWatchlistTab() {
  const qc = useQueryClient();
  const [horizon, setHorizon] = useState<Horizon>("24h");

  const { data, isLoading, isError, error, refetch } = usePspsWatchlist({ horizon });
  const is404 = isError && error instanceof ApiError && error.status === 404;

  const generate = useMutation({
    mutationFn: (overwrite: boolean) =>
      apiFetch("/psps-watchlist/generate", {
        method: "POST",
        body: JSON.stringify({ horizon, overwrite }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psps-watchlist"] }),
  });

  const watchlist: any[] =
    (data?.structured_data as any)?.watchlist && Array.isArray((data?.structured_data as any).watchlist)
      ? (data?.structured_data as any).watchlist
      : [];

  return (
    <div className="space-y-4">
      {/* Horizon selector */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => setHorizon(h)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              horizon === h ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      {isLoading && <ContentSkeleton />}
      {is404 || (!isLoading && !isError && !data) ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No watchlist generated for {horizon} horizon.</p>
          <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}>
            {generate.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              "Generate Watchlist"
            )}
          </Button>
        </div>
      ) : isError && !is404 ? (
        <InlineError message={(error as Error).message} onRetry={() => refetch()} />
      ) : data ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Date: <strong className="text-foreground">{data.watchlist_date}</strong></span>
            {data.model_used && <span>Model: {data.model_used}</span>}
            {data.tokens_used != null && <span>Tokens: {data.tokens_used.toLocaleString()}</span>}
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => generate.mutate(true)} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate New"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {/* Table or markdown fallback */}
          {watchlist.length > 0 ? (
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Rank</TableHead>
                    <TableHead className="text-xs">Circuit</TableHead>
                    <TableHead className="text-xs">Risk</TableHead>
                    <TableHead className="text-xs">Prob</TableHead>
                    <TableHead className="text-xs">Customers</TableHead>
                    <TableHead className="text-xs">Critical</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Rationale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((w: any, i: number) => (
                    <TableRow key={w.circuit_id ?? i}>
                      <TableCell className="text-xs">{w.rank ?? i + 1}</TableCell>
                      <TableCell className="text-xs font-mono">{w.circuit_id}</TableCell>
                      <TableCell><RiskBadge level={w.risk_bucket} /></TableCell>
                      <TableCell className="text-xs">{w.prob_spike != null ? (w.prob_spike * 100).toFixed(1) + "%" : "—"}</TableCell>
                      <TableCell className="text-xs">{w.customer_count?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell className="text-xs">{w.critical_customers?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{w.recommended_action ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{w.trigger_rationale ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-6"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown_text) }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function OpsIntelligence() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Ops Intelligence</h1>
            <p className="text-xs text-muted-foreground">Daily briefings · PSPS watchlists</p>
          </div>
        </div>

        <Tabs defaultValue="briefing" className="w-full">
          <TabsList>
            <TabsTrigger value="briefing">Daily Briefing</TabsTrigger>
            <TabsTrigger value="watchlist">PSPS Watchlist</TabsTrigger>
          </TabsList>
          <TabsContent value="briefing">
            <DailyBriefingTab />
          </TabsContent>
          <TabsContent value="watchlist">
            <PspsWatchlistTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

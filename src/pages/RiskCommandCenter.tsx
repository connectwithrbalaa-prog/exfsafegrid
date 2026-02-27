import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePsaRisk, useIgnitionRisk } from "@/hooks/use-api";
import RiskTable from "@/components/RiskTable";
import DetailsDrawer from "@/components/DetailsDrawer";
import TopNav from "@/components/TopNav";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const RISK_LEVELS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const LIMITS = ["50", "100", "200", "500"] as const;

/* ── PSA Risk Tab ──────────────────────────────────────────── */
function PsaRiskTab() {
  const [monthOffset, setMonthOffset] = useState<1 | 2 | 3>(1);
  const [minProbRaw, setMinProbRaw] = useState(0);
  const minProb = useDebounced(minProbRaw, 400);
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);

  const { data, isLoading, isError, error, refetch } = usePsaRisk({
    month_offset: monthOffset,
    min_prob: minProb > 0 ? minProb : undefined,
  });

  const filtered = useMemo(() => {
    let r = data?.results ?? [];
    if (riskFilter !== "ALL") r = r.filter((x) => x.risk_bucket === riskFilter);
    return r.slice(0, limit);
  }, [data, riskFilter, limit]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Month Offset</label>
          <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(Number(v) as 1 | 2 | 3)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[160px]">
          <label className="text-[10px] uppercase text-muted-foreground">
            Min Probability: {(minProbRaw * 100).toFixed(0)}%
          </label>
          <Slider min={0} max={1} step={0.05} value={[minProbRaw]} onValueChange={([v]) => setMinProbRaw(v)} className="py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Risk</label>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RISK_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Limit</label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-xs" />
      </div>

      {/* Content */}
      {isLoading && <TableSkeleton />}
      {isError && <InlineError message={(error as Error).message} onRetry={() => refetch()} />}
      {!isLoading && !isError && (
        <RiskTable
          results={filtered}
          probField="prob_above_normal"
          riskField="risk_bucket"
          onSelectRow={setSelectedRow}
          searchQuery={search}
        />
      )}
      <DetailsDrawer
        open={!!selectedRow}
        onOpenChange={(o) => !o && setSelectedRow(null)}
        row={selectedRow}
        probField="prob_above_normal"
        riskField="risk_bucket"
      />
    </div>
  );
}

/* ── Ignition Spike Tab ────────────────────────────────────── */
function IgnitionSpikeTab() {
  const [horizon, setHorizon] = useState<24 | 48 | 72>(24);
  const [riskBand, setRiskBand] = useState("ALL");
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);

  const { data, isLoading, isError, error, refetch } = useIgnitionRisk({
    horizon_hours: horizon,
    risk_band: riskBand !== "ALL" ? riskBand : undefined,
  });

  const filtered = useMemo(() => {
    return (data?.results ?? []).slice(0, limit);
  }, [data, limit]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Horizon</label>
          <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v) as 24 | 48 | 72)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24 h</SelectItem>
              <SelectItem value="48">48 h</SelectItem>
              <SelectItem value="72">72 h</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Risk Band</label>
          <Select value={riskBand} onValueChange={setRiskBand}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RISK_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Limit</label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-xs" />
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <InlineError message={(error as Error).message} onRetry={() => refetch()} />}
      {!isLoading && !isError && (
        <RiskTable
          results={filtered}
          probField="prob_spike"
          riskField="risk_band"
          onSelectRow={setSelectedRow}
          searchQuery={search}
          extraColumns={[{ key: "critical_customers", label: "Critical" }]}
        />
      )}
      <DetailsDrawer
        open={!!selectedRow}
        onOpenChange={(o) => !o && setSelectedRow(null)}
        row={selectedRow}
        probField="prob_spike"
        riskField="risk_band"
      />
    </div>
  );
}

/* ── Shared helpers ────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

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

/* ── Page ──────────────────────────────────────────────────── */
export default function RiskCommandCenter() {
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
            <h1 className="text-lg font-bold tracking-tight">Risk Command Center</h1>
            <p className="text-xs text-muted-foreground">Circuit-level risk predictions · PSA Activity · Ignition Spike</p>
          </div>
        </div>

        <Tabs defaultValue="psa" className="w-full">
          <TabsList>
            <TabsTrigger value="psa">PSA Risk</TabsTrigger>
            <TabsTrigger value="ignition">Ignition Spike</TabsTrigger>
          </TabsList>
          <TabsContent value="psa">
            <PsaRiskTab />
          </TabsContent>
          <TabsContent value="ignition">
            <IgnitionSpikeTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

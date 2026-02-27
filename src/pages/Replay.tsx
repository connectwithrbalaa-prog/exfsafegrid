import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopNav from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History, Play, ArrowUp, ArrowDown, Minus, Calendar, Zap, Users, AlertTriangle, Activity, Clock, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Metrics {
  totalCustomers: number;
  residential: number;
  commercial: number;
  critical: number;
  mwLost: number;
  restorationHours: number;
  summary?: string;
}

function DeltaIndicator({ a, b, unit = "" }: { a: number; b: number; unit?: string }) {
  const diff = b - a;
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />0{unit}</span>;
  const isUp = diff > 0;
  const pct = a > 0 ? ((diff / a) * 100).toFixed(1) : "—";
  return (
    <span className={cn("text-xs font-medium flex items-center gap-0.5", isUp ? "text-destructive" : "text-green-600 dark:text-green-400")}>
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{diff.toLocaleString()}{unit}
      <span className="text-muted-foreground ml-1">({pct}%)</span>
    </span>
  );
}

export default function Replay() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["psps-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psps_events" as any)
        .select("*")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const replayMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke("psps-replay", {
        body: { psps_event_id: eventId },
      });
      if (error) throw error;
      return data as {
        original: Metrics;
        rerun: Metrics;
        aiSummary: string;
        event: any;
      };
    },
  });

  const selectedEvent = events.find((e: any) => e.id === selectedEventId);

  const handleRerun = () => {
    if (!selectedEventId) return;
    replayMutation.mutate(selectedEventId);
  };

  const result = replayMutation.data;

  const metricRows = result
    ? [
        { label: "Total Customers", icon: Users, old: result.original.totalCustomers, new_: result.rerun.totalCustomers, unit: "" },
        { label: "Critical", icon: AlertTriangle, old: result.original.critical, new_: result.rerun.critical, unit: "" },
        { label: "Residential", icon: Users, old: result.original.residential, new_: result.rerun.residential, unit: "" },
        { label: "Commercial", icon: Users, old: result.original.commercial, new_: result.rerun.commercial, unit: "" },
        { label: "MW Lost", icon: Activity, old: result.original.mwLost, new_: result.rerun.mwLost, unit: " MW" },
        { label: "Restoration", icon: Clock, old: result.original.restorationHours, new_: result.rerun.restorationHours, unit: "h" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav variant="dark" />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Historical PSPS Replay
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a past PSPS event, re-run it with current network &amp; risk models, and compare outcomes.
          </p>
        </div>

        {/* Event selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Past Event</CardTitle>
            <CardDescription className="text-xs">
              Choose a historical PSPS de-energization event to replay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {eventsLoading ? (
              <div className="text-sm text-muted-foreground">Loading events…</div>
            ) : (
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event…" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {e.event_name} — {new Date(e.event_date).toLocaleDateString()}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected event info */}
            {selectedEvent && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{selectedEvent.event_name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {selectedEvent.circuit_ids?.length || 0} circuits</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {selectedEvent.total_customers?.toLocaleString()} customers</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedEvent.horizon_hours}h horizon</span>
                </div>
                {selectedEvent.summary && (
                  <p className="text-xs text-muted-foreground italic">{selectedEvent.summary}</p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedEventId || replayMutation.isPending}
              onClick={handleRerun}
            >
              {replayMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Re-running…</>
              ) : (
                <><Play className="w-4 h-4 mr-1" /> Re-run with Current Models</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {replayMutation.isError && (
          <Card className="border-destructive/40">
            <CardContent className="pt-4 text-sm text-destructive">
              Error: {(replayMutation.error as any)?.message || "Replay failed"}
            </CardContent>
          </Card>
        )}

        {/* Results comparison */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Old vs. New Comparison
            </h2>

            <Card>
              <CardContent className="pt-4 pb-3 space-y-0">
                {/* Header */}
                <div className="grid grid-cols-4 gap-2 pb-2 border-b border-border text-xs font-semibold text-muted-foreground">
                  <span>Metric</span>
                  <span className="text-right">Original</span>
                  <span className="text-right">Re-run</span>
                  <span className="text-right">Delta</span>
                </div>

                {metricRows.map((m) => (
                  <div key={m.label} className="grid grid-cols-4 gap-2 py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <m.icon className="w-3 h-3" /> {m.label}
                    </span>
                    <span className="text-right font-medium text-foreground">
                      {m.old.toLocaleString()}{m.unit}
                    </span>
                    <span className="text-right font-medium text-foreground">
                      {m.new_.toLocaleString()}{m.unit}
                    </span>
                    <span className="text-right">
                      <DeltaIndicator a={m.old} b={m.new_} unit={m.unit} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* AI Summary */}
            {result.aiSummary && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Comparison Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed">{result.aiSummary}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

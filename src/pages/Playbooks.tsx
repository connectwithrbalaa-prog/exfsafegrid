import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopNav from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Zap, Trash2, Calendar, Users, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Playbooks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["psps-playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psps_playbooks" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("psps_playbooks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psps-playbooks"] });
      toast({ title: "Playbook deleted" });
    },
  });

  const openInSimulator = (p: any) => {
    // Store playbook data in sessionStorage for the simulator to pick up
    sessionStorage.setItem(
      "playbook_load",
      JSON.stringify({
        name: p.name,
        circuit_ids: p.circuit_ids,
        baseline_metrics: p.baseline_metrics,
      })
    );
    navigate("/psps-simulator");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav variant="dark" />
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> PSPS Playbooks
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Saved de-energization playbooks for rapid scenario modeling.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/psps-simulator")}>
            <Zap className="w-4 h-4 mr-1" /> Open Simulator
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading playbooks…</div>
        ) : playbooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No playbooks saved yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run a simulation and click "Save as Playbook" to create one.
              </p>
              <Button className="mt-4" onClick={() => navigate("/psps-simulator")}>
                Go to Simulator
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {playbooks.map((p: any) => {
              const metrics = p.baseline_metrics || {};
              const tags: string[] = p.tags || [];
              return (
                <Card key={p.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Metrics summary */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        {(p.circuit_ids?.length || 0)} circuits
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {(metrics.totalCustomers || 0).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="w-3 h-3" />
                        {metrics.mwLost || 0} MW
                      </div>
                    </div>

                    {/* Date + action */}
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                      <Button size="sm" className="h-7 text-xs" onClick={() => openInSimulator(p)}>
                        <Zap className="w-3 h-3 mr-1" /> Open in Simulator
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

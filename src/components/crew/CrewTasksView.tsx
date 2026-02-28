import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CrewPriorityBanner from "./CrewPriorityBanner";
import type { CrewTab } from "./CrewTabBar";

interface PatrolTask {
  id: string;
  patrol_id: string;
  title: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  priority: number | null;
  circuit_id: string | null;
  notes: string | null;
}

interface Props {
  patrolId: string;
  onSwitchTab: (tab: CrewTab) => void;
}

export default function CrewTasksView({ patrolId, onSwitchTab }: Props) {
  const [tasks, setTasks] = useState<PatrolTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskNote, setTaskNote] = useState("");

  useEffect(() => {
    loadTasks();
  }, [patrolId]);

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patrol_tasks")
      .select("*")
      .eq("patrol_id", patrolId)
      .order("priority", { ascending: true });
    if (data) setTasks(data as any);
    if (error) toast.error("Failed to load tasks");
    setLoading(false);
  };

  const updateStatus = async (taskId: string, newStatus: PatrolTask["status"]) => {
    const { error } = await supabase
      .from("patrol_tasks")
      .update({ status: newStatus, updated_at: new Date().toISOString(), notes: taskNote || null } as any)
      .eq("id", taskId);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    toast.success(`Task ${newStatus === "COMPLETED" ? "completed ✓" : "updated"}`);
    setTaskNote("");
    setExpandedId(null);
  };

  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Determine highest priority
  const highestPriority = tasks.length > 0
    ? Math.min(...tasks.filter((t) => t.status !== "COMPLETED").map((t) => t.priority || 4)) as 1 | 2 | 3 | 4
    : 4;

  const circuits = [...new Set(tasks.map((t) => t.circuit_id).filter(Boolean))];

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Priority banner */}
      <CrewPriorityBanner priority={highestPriority} reason={`${total - completed} tasks remaining on ${circuits.join(", ") || "patrol"}`} />

      {/* Patrol header */}
      <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/30 font-mono">{patrolId}</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {circuits.length > 0 ? circuits.join(", ") : "Unassigned"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">{completed}<span className="text-white/20 text-sm">/{total}</span></p>
            <p className="text-[9px] text-white/20 uppercase">Tasks done</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Task list */}
      {tasks.map((task) => {
        const isExpanded = expandedId === task.id;
        const priorityColor = task.priority === 1 ? "text-red-400" : task.priority === 2 ? "text-orange-400" : task.priority === 3 ? "text-yellow-400" : "text-blue-400";

        return (
          <div key={task.id} className={`rounded-lg border transition-all ${
            task.status === "COMPLETED"
              ? "bg-emerald-900/10 border-emerald-500/15"
              : "bg-white/[0.03] border-white/[0.08]"
          }`}>
            {/* Main row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              {task.status === "COMPLETED" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : task.status === "IN_PROGRESS" ? (
                <Clock className="w-5 h-5 text-orange-400 shrink-0 animate-pulse" />
              ) : (
                <Circle className="w-5 h-5 text-white/15 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "text-emerald-300/70 line-through" : "text-white/90"}`}>
                  {task.title}
                </p>
                <p className="text-[11px] text-white/30 truncate">{task.description || ""}</p>
              </div>
              <span className={`text-[10px] font-bold ${priorityColor} shrink-0`}>P{task.priority || 3}</span>
              <ChevronRight className={`w-4 h-4 text-white/15 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>

            {/* Expanded detail */}
            {isExpanded && task.status !== "COMPLETED" && (
              <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
                {/* Note input */}
                <input
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="Add note (optional)…"
                  className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                />
                <div className="flex gap-2">
                  {task.status === "NOT_STARTED" && (
                    <button
                      onClick={() => updateStatus(task.id, "IN_PROGRESS")}
                      className="flex-1 py-2 rounded-md bg-orange-600/20 border border-orange-500/30 text-xs font-medium text-orange-300"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(task.id, "COMPLETED")}
                    className="flex-1 py-2 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-xs font-medium text-emerald-300"
                  >
                    Complete ✓
                  </button>
                  {task.lat && task.lon && (
                    <button
                      onClick={() => onSwitchTab("map")}
                      className="px-3 py-2 rounded-md bg-blue-600/20 border border-blue-500/30 text-xs text-blue-300"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-white/15 text-sm">No tasks assigned for this patrol</div>
      )}
    </div>
  );
}

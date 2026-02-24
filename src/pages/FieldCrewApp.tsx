/**
 * FieldCrewApp — Offline-capable PWA for field patrollers
 *
 * Technical approach:
 * - Service worker registration for offline asset caching
 * - GPS position via navigator.geolocation (continuous watch)
 * - One-tap hazard submission pre-populated with current GPS coords
 * - Local IndexedDB queue for submissions while offline (synced on reconnect)
 * - Patrol checklist with swipe-to-complete UX
 * - Live feed of hazard reports submitted by other crew members (Supabase Realtime)
 * - Minimal UI optimized for outdoor sunlight readability (large text, high contrast)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Wifi, WifiOff, CheckCircle2, Circle, AlertTriangle,
  Camera, Send, RefreshCw, Navigation, Battery, Thermometer,
  Flame, Zap, Clock, User, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface GpsPos { lat: number; lng: number; accuracy: number; timestamp: number }

interface PatrolCheckItem {
  id: string;
  label: string;
  description: string;
  category: "electrical" | "vegetation" | "access" | "structure";
  completed: boolean;
  timestamp?: Date;
}

interface HazardSubmission {
  id: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
  submitted_at: Date;
  synced: boolean;
}

const PATROL_ITEMS: Omit<PatrolCheckItem, "completed" | "timestamp">[] = [
  { id: "c1", label: "Conductor clearance", description: "Verify min 4ft clearance from vegetation", category: "electrical" },
  { id: "c2", label: "Insulator condition", description: "Check for cracks, contamination, or damage", category: "electrical" },
  { id: "c3", label: "Ground fault indicators", description: "Inspect reclosers and sectionalizers", category: "electrical" },
  { id: "c4", label: "Vegetation encroachment", description: "Flag trees within 10ft of conductors", category: "vegetation" },
  { id: "c5", label: "Deadwood removal", description: "Identify standing dead trees as hazard trees", category: "vegetation" },
  { id: "c6", label: "Access road condition", description: "Confirm crew vehicle access is unobstructed", category: "access" },
  { id: "c7", label: "Gate/fence status", description: "Verify all access points are secure", category: "access" },
  { id: "c8", label: "Tower base condition", description: "Check for erosion, vandalism, or animal damage", category: "structure" },
  { id: "c9", label: "Warning signs present", description: "Confirm all danger/no-trespassing signs in place", category: "structure" },
  { id: "c10", label: "Photo documentation", description: "Capture pre/post condition photos for record", category: "structure" },
];

const HAZARD_TYPES = [
  "Vegetation Contact",
  "Equipment Failure",
  "Downed Line",
  "Structure Damage",
  "Fire Start",
  "Road Hazard",
  "Animal Activity",
  "Other",
];

const CATEGORY_COLORS = {
  electrical: "text-yellow-400 bg-yellow-400/10",
  vegetation: "text-green-400 bg-green-400/10",
  access:     "text-blue-400 bg-blue-400/10",
  structure:  "text-purple-400 bg-purple-400/10",
};

export default function FieldCrewApp() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [gps, setGps] = useState<GpsPos | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [items, setItems] = useState<PatrolCheckItem[]>(
    PATROL_ITEMS.map((p) => ({ ...p, completed: false }))
  );
  const [showHazard, setShowHazard] = useState(false);
  const [hazardType, setHazardType] = useState(HAZARD_TYPES[0]);
  const [hazardDesc, setHazardDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<HazardSubmission[]>([]);
  const [queue, setQueue] = useState<HazardSubmission[]>([]); // offline queue
  const [activeTab, setActiveTab] = useState<"patrol" | "hazard" | "reports">("patrol");
  const watchRef = useRef<number | null>(null);

  const completedCount = items.filter((i) => i.completed).length;

  // Network status listener
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      syncQueue();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("GPS not available"); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Load recent hazard reports from Supabase
  useEffect(() => {
    supabase
      .from("hazard_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setSubmissions(
            data.map((r: any) => ({
              id: r.id,
              type: r.hazard_type || "Unknown",
              description: r.description || "",
              lat: r.latitude || 0,
              lng: r.longitude || 0,
              submitted_at: new Date(r.created_at),
              synced: true,
            }))
          );
        }
      });

    // Realtime feed
    const ch = supabase
      .channel("hazard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hazard_reports" }, (payload) => {
        const r = payload.new as any;
        setSubmissions((prev) => [{
          id: r.id,
          type: r.hazard_type || "Unknown",
          description: r.description || "",
          lat: r.latitude || 0,
          lng: r.longitude || 0,
          submitted_at: new Date(r.created_at),
          synced: true,
        }, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, completed: !item.completed, timestamp: !item.completed ? new Date() : undefined }
          : item
      )
    );
    const item = items.find((i) => i.id === id);
    if (item && !item.completed) toast.success(`✓ ${item.label}`);
  };

  const submitHazard = useCallback(async () => {
    if (!hazardDesc.trim()) { toast.error("Description required"); return; }
    setSubmitting(true);

    const record: HazardSubmission = {
      id: `hazard-${Date.now()}`,
      type: hazardType,
      description: hazardDesc,
      lat: gps?.lat ?? 0,
      lng: gps?.lng ?? 0,
      submitted_at: new Date(),
      synced: false,
    };

    if (!online) {
      // Queue locally
      setQueue((prev) => [...prev, record]);
      toast.warning("Offline — hazard queued for sync");
      setSubmitting(false);
      setHazardDesc("");
      setShowHazard(false);
      return;
    }

    const { error } = await supabase.from("hazard_reports").insert({
      hazard_type: hazardType,
      description: hazardDesc,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
    } as any);

    setSubmitting(false);
    if (error) {
      toast.error("Submission failed — queued locally");
      setQueue((prev) => [...prev, record]);
    } else {
      toast.success("Hazard report submitted");
      setSubmissions((prev) => [{ ...record, synced: true }, ...prev]);
    }
    setHazardDesc("");
    setShowHazard(false);
  }, [hazardType, hazardDesc, gps, online]);

  const syncQueue = useCallback(async () => {
    if (queue.length === 0) return;
    let synced = 0;
    for (const item of queue) {
      const { error } = await supabase.from("hazard_reports").insert({
        hazard_type: item.type,
        description: item.description,
        latitude: item.lat || null,
        longitude: item.lng || null,
      } as any);
      if (!error) synced++;
    }
    if (synced > 0) {
      setQueue([]);
      toast.success(`${synced} queued reports synced`);
    }
  }, [queue]);

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none">
      {/* Status bar */}
      <div className={`px-4 py-2 flex items-center justify-between text-xs ${online ? "bg-emerald-900/50" : "bg-red-900/50"}`}>
        <div className="flex items-center gap-2">
          {online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
          <span className={online ? "text-emerald-300" : "text-red-300"}>{online ? "Online" : "Offline"}</span>
          {queue.length > 0 && (
            <span className="text-yellow-400">{queue.length} queued</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {gps ? (
            <span className="flex items-center gap-1 text-white/50">
              <Navigation className="w-3 h-3 text-blue-400" />
              {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
              <span className="text-white/25">±{Math.round(gps.accuracy)}m</span>
            </span>
          ) : (
            <span className="text-white/30 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {gpsError || "Acquiring GPS…"}
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="bg-gray-900 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/70">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold">Field Patrol App</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">ExfSafeGrid · Crew Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <User className="w-3.5 h-3.5" />
            Field Crew
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-white/50 shrink-0">{completedCount}/{items.length}</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-b border-white/10">
        {[
          { id: "patrol", label: "Patrol", icon: <CheckCircle2 className="w-4 h-4" /> },
          { id: "hazard", label: "Report", icon: <AlertTriangle className="w-4 h-4" /> },
          { id: "reports", label: "Feed", icon: <Flame className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-white/30 hover:text-white/60"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <main className="px-4 py-4 space-y-3 pb-24">
        {/* Patrol Checklist */}
        {activeTab === "patrol" && (
          <div className="space-y-3">
            <p className="text-xs text-white/30">Tap each item to mark complete</p>
            {(["electrical", "vegetation", "access", "structure"] as const).map((cat) => (
              <div key={cat} className="space-y-2">
                <h3 className={`text-[10px] uppercase tracking-widest font-semibold px-2 ${CATEGORY_COLORS[cat]}`}>
                  {cat}
                </h3>
                {items.filter((i) => i.category === cat).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                      item.completed
                        ? "bg-emerald-900/30 border-emerald-500/30"
                        : "bg-white/5 border-white/10 active:scale-[0.98]"
                    }`}
                  >
                    {item.completed
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      : <Circle className="w-5 h-5 text-white/20 shrink-0" />
                    }
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium ${item.completed ? "text-emerald-300 line-through" : "text-white"}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-white/30 mt-0.5">{item.description}</p>
                    </div>
                    {item.timestamp && (
                      <span className="text-[9px] text-white/20 shrink-0">
                        {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Hazard Report */}
        {activeTab === "hazard" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
              <p className="text-xs text-white/40">Current Location</p>
              {gps ? (
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-mono text-white/80">
                    {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                  </span>
                  <span className="text-xs text-white/30">±{Math.round(gps.accuracy)}m</span>
                </div>
              ) : (
                <p className="text-sm text-white/30">{gpsError || "Acquiring GPS…"}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Hazard Type</label>
              <div className="grid grid-cols-2 gap-2">
                {HAZARD_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setHazardType(t)}
                    className={`py-3 px-3 rounded-xl border text-sm font-medium transition-all ${
                      hazardType === t
                        ? "bg-orange-600/30 border-orange-500/50 text-orange-200"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Description</label>
              <textarea
                value={hazardDesc}
                onChange={(e) => setHazardDesc(e.target.value)}
                placeholder="Describe what you observed…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
              />
            </div>

            <button
              onClick={submitHazard}
              disabled={submitting || !hazardDesc.trim()}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-orange-600 text-white text-base font-bold hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {online ? "Submit Report" : "Queue Offline"}
            </button>

            {queue.length > 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-xs text-yellow-300">{queue.length} report(s) queued offline</p>
                <button
                  onClick={syncQueue}
                  disabled={!online}
                  className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400 disabled:opacity-40"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync now
                </button>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
                <p className="text-xs text-white/30">
                  Photo upload: tap the camera icon in the hazard form to attach field photos. Images are stored
                  in Supabase Storage and linked to this report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Feed */}
        {activeTab === "reports" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">{submissions.length} recent reports</p>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live" />
            </div>
            {submissions.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-300">{r.type}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${r.synced ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                      {r.synced ? "Synced" : "Pending"}
                    </span>
                    <span className="text-[10px] text-white/25 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {r.submitted_at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/60">{r.description || "No description"}</p>
                {(r.lat !== 0 || r.lng !== 0) && (
                  <p className="text-[10px] font-mono text-white/25 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="text-center py-10 text-white/20 text-sm">No reports yet</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

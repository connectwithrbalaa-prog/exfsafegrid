/**
 * FieldCrewApp — Offline-capable PWA for field patrollers
 * Simplified UI with clean card layouts and reduced density
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Wifi, WifiOff, CheckCircle2, Circle, AlertTriangle,
  Camera, Send, RefreshCw, Navigation, Clock, User, ArrowLeft, LogOut, Flame, X, Image,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TopNav from "@/components/TopNav";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCustomer } from "@/hooks/use-customer";

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
  { id: "c1", label: "Conductor clearance", description: "Min 4ft from vegetation", category: "electrical" },
  { id: "c2", label: "Insulator condition", description: "Check cracks or damage", category: "electrical" },
  { id: "c3", label: "Ground fault indicators", description: "Inspect reclosers", category: "electrical" },
  { id: "c4", label: "Vegetation encroachment", description: "Trees within 10ft of conductors", category: "vegetation" },
  { id: "c5", label: "Deadwood removal", description: "Standing dead trees", category: "vegetation" },
  { id: "c6", label: "Access road condition", description: "Vehicle access clear", category: "access" },
  { id: "c7", label: "Gate/fence status", description: "Access points secure", category: "access" },
  { id: "c8", label: "Tower base condition", description: "Erosion or damage", category: "structure" },
  { id: "c9", label: "Warning signs", description: "Danger signs in place", category: "structure" },
  { id: "c10", label: "Photo documentation", description: "Pre/post condition photos", category: "structure" },
];

const HAZARD_TYPES = [
  "Vegetation Contact", "Equipment Failure", "Downed Line", "Structure Damage",
  "Fire Start", "Road Hazard", "Animal Activity", "Other",
];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  electrical: { label: "Electrical", color: "text-yellow-400" },
  vegetation: { label: "Vegetation", color: "text-green-400" },
  access: { label: "Access", color: "text-blue-400" },
  structure: { label: "Structure", color: "text-purple-400" },
};

export default function FieldCrewApp() {
  const navigate = useNavigate();
  const { setCustomer, setRole, setAgentEmail } = useCustomer();
  const [online, setOnline] = useState(navigator.onLine);
  const [gps, setGps] = useState<GpsPos | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [items, setItems] = useState<PatrolCheckItem[]>(
    PATROL_ITEMS.map((p) => ({ ...p, completed: false }))
  );
  const [hazardType, setHazardType] = useState(HAZARD_TYPES[0]);
  const [hazardDesc, setHazardDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<HazardSubmission[]>([]);
  const [queue, setQueue] = useState<HazardSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<"patrol" | "hazard" | "reports">("patrol");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchRef = useRef<number | null>(null);

  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);
  const [patrolStart] = useState(() => new Date());
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - patrolStart.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [patrolStart]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); syncQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("GPS not available"); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp });
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  useEffect(() => {
    supabase.from("hazard_reports").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => {
        if (data) {
          setSubmissions(data.map((r: any) => ({
            id: r.id, type: r.hazard_type || "Unknown", description: r.description || "",
            lat: r.latitude || 0, lng: r.longitude || 0, submitted_at: new Date(r.created_at), synced: true,
          })));
        }
      });

    const ch = supabase.channel("hazard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hazard_reports" }, (payload) => {
        const r = payload.new as any;
        setSubmissions((prev) => [{
          id: r.id, type: r.hazard_type || "Unknown", description: r.description || "",
          lat: r.latitude || 0, lng: r.longitude || 0, submitted_at: new Date(r.created_at), synced: true,
        }, ...prev]);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, completed: !item.completed, timestamp: !item.completed ? new Date() : undefined } : item
    ));
    const item = items.find((i) => i.id === id);
    if (item && !item.completed) toast.success(`✓ ${item.label}`);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("JPEG, PNG or WebP only"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;
    setUploadingPhoto(true);
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `field/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("hazard-photos").upload(path, photoFile, { contentType: photoFile.type });
    setUploadingPhoto(false);
    if (error) { toast.error("Photo upload failed"); return null; }
    const { data: urlData } = supabase.storage.from("hazard-photos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const submitHazard = useCallback(async () => {
    if (!hazardDesc.trim()) { toast.error("Description required"); return; }
    setSubmitting(true);
    const record: HazardSubmission = {
      id: `hazard-${Date.now()}`, type: hazardType, description: hazardDesc,
      lat: gps?.lat ?? 0, lng: gps?.lng ?? 0, submitted_at: new Date(), synced: false,
    };

    if (!online) {
      setQueue((prev) => [...prev, record]);
      toast.warning("Offline — queued for sync");
      setSubmitting(false); setHazardDesc(""); clearPhoto(); return;
    }

    // Upload photo first if present
    const photoUrl = await uploadPhoto();

    const { error } = await supabase.from("hazard_reports").insert({
      hazard_type: hazardType, description: hazardDesc,
      latitude: gps?.lat ?? null, longitude: gps?.lng ?? null,
      photo_url: photoUrl,
    } as any);

    setSubmitting(false);
    if (error) { toast.error("Failed — queued locally"); setQueue((prev) => [...prev, record]); }
    else { toast.success("Report submitted"); setSubmissions((prev) => [{ ...record, synced: true }, ...prev]); }
    setHazardDesc("");
    clearPhoto();
  }, [hazardType, hazardDesc, gps, online, photoFile]);

  const syncQueue = useCallback(async () => {
    if (queue.length === 0) return;
    let synced = 0;
    for (const item of queue) {
      const { error } = await supabase.from("hazard_reports").insert({
        hazard_type: item.type, description: item.description,
        latitude: item.lat || null, longitude: item.lng || null,
      } as any);
      if (!error) synced++;
    }
    if (synced > 0) { setQueue([]); toast.success(`${synced} queued reports synced`); }
  }, [queue]);

  const tabs = [
    { id: "patrol" as const, label: "Patrol", icon: CheckCircle2 },
    { id: "hazard" as const, label: "Report", icon: AlertTriangle },
    { id: "reports" as const, label: "Feed", icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none">
      <TopNav variant="dark" />

      {/* Compact status strip */}
      <div className={`px-4 py-1.5 flex items-center justify-between text-[11px] ${online ? "bg-emerald-900/40" : "bg-red-900/40"}`}>
        <div className="flex items-center gap-2">
          {online ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
          <span className={online ? "text-emerald-300" : "text-red-300"}>{online ? "Online" : "Offline"}</span>
          {queue.length > 0 && <span className="text-yellow-400">· {queue.length} queued</span>}
        </div>
        {gps ? (
          <span className="text-white/40 font-mono">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</span>
        ) : (
          <span className="text-white/25">{gpsError || "Acquiring GPS…"}</span>
        )}
      </div>

      {/* Header */}
      <header className="bg-gray-900/80 border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/60"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-base font-bold">Field Patrol</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded-md font-mono">{progress}%</span>
            <button
              onClick={() => { setCustomer(null); setRole("customer"); setAgentEmail(null); navigate("/login"); }}
              className="text-white/30 hover:text-white/60"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-gray-900/50 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id ? "border-orange-500 text-orange-400" : "border-transparent text-white/25 hover:text-white/50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <main className="px-4 py-4 pb-20">
        {/* ── PATROL TAB ── */}
        {activeTab === "patrol" && (
          <div className="space-y-4">
            {/* Summary dashboard */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald-400">{completedCount}<span className="text-white/20 text-xs font-normal">/{items.length}</span></p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Completed</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-orange-400">{items.length - completedCount}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Remaining</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-blue-400 font-mono">{elapsed}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Elapsed</p>
              </div>
            </div>

            {(["electrical", "vegetation", "access", "structure"] as const).map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              const catDone = catItems.filter((i) => i.completed).length;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase tracking-widest font-semibold ${CATEGORY_META[cat].color}`}>
                      {CATEGORY_META[cat].label}
                    </span>
                    <span className="text-[10px] text-white/20">{catDone}/{catItems.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {catItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                          item.completed
                            ? "bg-emerald-900/20 border-emerald-500/20"
                            : "bg-white/[0.03] border-white/[0.06] active:scale-[0.98]"
                        }`}
                      >
                        {item.completed
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          : <Circle className="w-4 h-4 text-white/15 shrink-0" />
                        }
                        <div className="flex-1 text-left min-w-0">
                          <p className={`text-sm ${item.completed ? "text-emerald-300/70 line-through" : "text-white/80"}`}>{item.label}</p>
                          <p className="text-[10px] text-white/20 truncate">{item.description}</p>
                        </div>
                        {item.timestamp && (
                          <span className="text-[9px] text-white/15 shrink-0">
                            {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── HAZARD TAB ── */}
        {activeTab === "hazard" && (
          <div className="space-y-4">
            {/* Location badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {gps ? (
                <span className="text-xs font-mono text-white/50">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} <span className="text-white/20">±{Math.round(gps.accuracy)}m</span></span>
              ) : (
                <span className="text-xs text-white/25">{gpsError || "Acquiring GPS…"}</span>
              )}
            </div>

            {/* Type selector */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {HAZARD_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setHazardType(t)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                      hazardType === t
                        ? "bg-orange-600/20 border-orange-500/40 text-orange-300"
                        : "bg-white/[0.03] border-white/[0.06] text-white/30"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea
                value={hazardDesc}
                onChange={(e) => setHazardDesc(e.target.value)}
                placeholder="What did you observe?"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500/30 resize-none"
              />
            </div>

            {/* Photo capture */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-white/[0.06]">
                  <img src={photoPreview} alt="Hazard preview" className="w-full h-40 object-cover" />
                  <button
                    onClick={clearPhoto}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/80 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-white/25 hover:text-white/40 hover:border-white/20 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">Tap to capture photo</span>
                </button>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={submitHazard}
              disabled={submitting || uploadingPhoto || !hazardDesc.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-30 transition-colors"
            >
              {(submitting || uploadingPhoto) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {uploadingPhoto ? "Uploading…" : online ? "Submit" : "Queue Offline"}
            </button>

            {/* Offline queue */}
            {queue.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5">
                <span className="text-xs text-yellow-300">{queue.length} queued</span>
                <button onClick={syncQueue} disabled={!online} className="text-xs text-yellow-400 disabled:opacity-30">Sync</button>
              </div>
            )}
          </div>
        )}

        {/* ── FEED TAB ── */}
        {activeTab === "reports" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/25 uppercase tracking-wider">{submissions.length} reports</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {submissions.map((r) => (
              <div key={r.id} className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-300">{r.type}</span>
                  <span className="text-[9px] text-white/20 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {r.submitted_at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-white/40 line-clamp-2">{r.description || "No description"}</p>
                {(r.lat !== 0 || r.lng !== 0) && (
                  <p className="text-[9px] font-mono text-white/15">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</p>
                )}
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="text-center py-12 text-white/15 text-sm">No reports yet</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

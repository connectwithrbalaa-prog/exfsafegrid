import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Send, RefreshCw, Navigation, Clock, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GpsPos { lat: number; lng: number; accuracy: number }

interface HazardSubmission {
  id: string;
  type: string;
  description: string;
  submitted_at: Date;
  synced: boolean;
  photo_url?: string | null;
}

const HAZARD_TYPES = [
  "Vegetation Contact", "Equipment Failure", "Downed Line", "Structure Damage",
  "Fire Start", "Road Hazard", "Animal Activity", "Other",
];

interface Props {
  gps: GpsPos | null;
  online: boolean;
  queue: HazardSubmission[];
  setQueue: React.Dispatch<React.SetStateAction<HazardSubmission[]>>;
}

export default function CrewReportsView({ gps, online, queue, setQueue }: Props) {
  const [submissions, setSubmissions] = useState<HazardSubmission[]>([]);
  const [hazardType, setHazardType] = useState(HAZARD_TYPES[0]);
  const [hazardDesc, setHazardDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"submit" | "feed">("submit");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    supabase.from("hazard_reports").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => {
        if (data) {
          setSubmissions(data.map((r: any) => ({
            id: r.id, type: r.hazard_type || "Unknown", description: r.description || "",
            submitted_at: new Date(r.created_at), synced: true, photo_url: r.photo_url || null,
          })));
        }
      });

    const ch = supabase.channel("hazard-rt-crew")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hazard_reports" }, (payload) => {
        const r = payload.new as any;
        setSubmissions((prev) => [{
          id: r.id, type: r.hazard_type || "Unknown", description: r.description || "",
          submitted_at: new Date(r.created_at), synced: true, photo_url: r.photo_url || null,
        }, ...prev]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
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
      submitted_at: new Date(), synced: false,
    };
    if (!online) {
      setQueue((prev) => [...prev, record]);
      toast.warning("Offline — queued for sync");
      setSubmitting(false); setHazardDesc(""); clearPhoto(); return;
    }
    const photoUrl = await uploadPhoto();
    const { error } = await supabase.from("hazard_reports").insert({
      hazard_type: hazardType, description: hazardDesc,
      photo_url: photoUrl,
    } as any);
    setSubmitting(false);
    if (error) { toast.error("Failed — queued"); setQueue((prev) => [...prev, record]); }
    else { toast.success("Report submitted ✓"); setSubTab("feed"); }
    setHazardDesc(""); clearPhoto();
  }, [hazardType, hazardDesc, gps, online, photoFile]);

  const syncQueue = useCallback(async () => {
    if (queue.length === 0) return;
    let synced = 0;
    for (const item of queue) {
      const { error } = await supabase.from("hazard_reports").insert({
        hazard_type: item.type, description: item.description,
      } as any);
      if (!error) synced++;
    }
    if (synced > 0) { setQueue([]); toast.success(`${synced} queued reports synced`); }
  }, [queue]);

  return (
    <div className="space-y-3">
      {/* Sub-tabs: Submit / Feed */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
        <button
          onClick={() => setSubTab("submit")}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            subTab === "submit" ? "bg-orange-600 text-white" : "text-white/30"
          }`}
        >Submit Report</button>
        <button
          onClick={() => setSubTab("feed")}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            subTab === "feed" ? "bg-orange-600 text-white" : "text-white/30"
          }`}
        >Feed ({submissions.length})</button>
      </div>

      {subTab === "submit" && (
        <div className="space-y-3">
          {/* GPS badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            {gps ? (
              <span className="text-xs font-mono text-white/50">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} <span className="text-white/20">±{Math.round(gps.accuracy)}m</span></span>
            ) : (
              <span className="text-xs text-white/25">Acquiring GPS…</span>
            )}
          </div>

          {/* Type grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {HAZARD_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setHazardType(t)}
                className={`py-2.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                  hazardType === t
                    ? "bg-orange-600/20 border-orange-500/40 text-orange-300"
                    : "bg-white/[0.03] border-white/[0.06] text-white/30"
                }`}
              >{t}</button>
            ))}
          </div>

          {/* Description */}
          <textarea
            value={hazardDesc}
            onChange={(e) => setHazardDesc(e.target.value)}
            placeholder="What did you observe?"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500/30 resize-none"
          />

          {/* Photo */}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhotoSelect} className="hidden" />
          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden border border-white/[0.06]">
              <img src={photoPreview} alt="Preview" className="w-full h-36 object-cover" />
              <button onClick={clearPhoto} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/80"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-white/25">
              <Camera className="w-5 h-5" /><span className="text-xs">Tap to capture photo</span>
            </button>
          )}

          {/* Submit */}
          <button onClick={submitHazard} disabled={submitting || uploadingPhoto || !hazardDesc.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-600 text-white text-sm font-semibold disabled:opacity-30">
            {(submitting || uploadingPhoto) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {uploadingPhoto ? "Uploading…" : online ? "Submit" : "Queue Offline"}
          </button>

          {queue.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5">
              <span className="text-xs text-yellow-300">{queue.length} queued</span>
              <button onClick={syncQueue} disabled={!online} className="text-xs text-yellow-400 disabled:opacity-30">Sync</button>
            </div>
          )}
        </div>
      )}

      {subTab === "feed" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/25 uppercase tracking-wider">{submissions.length} reports</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          {submissions.map((r) => (
            <div key={r.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
              {r.photo_url && (
                <button onClick={() => setLightboxUrl(r.photo_url!)} className="w-full">
                  <img src={r.photo_url} alt={r.type} className="w-full h-36 object-cover" />
                </button>
              )}
              <div className="px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-300">{r.type}</span>
                  <span className="text-[9px] text-white/20 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {r.submitted_at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-white/40 line-clamp-2">{r.description || "No description"}</p>
              </div>
            </div>
          ))}
          {submissions.length === 0 && <div className="text-center py-12 text-white/15 text-sm">No reports yet</div>}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (() => {
        const photoUrls = submissions.filter((s) => s.photo_url).map((s) => s.photo_url!);
        const currentIdx = photoUrls.indexOf(lightboxUrl);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < photoUrls.length - 1;
        const goTo = (i: number) => setLightboxUrl(photoUrls[i]);
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const diff = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(diff) < 50) return;
              if (diff < 0 && hasNext) goTo(currentIdx + 1);
              if (diff > 0 && hasPrev) goTo(currentIdx - 1);
            }}
          >
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white/70 z-10"><X className="w-6 h-6" /></button>
            {hasPrev && <button onClick={(e) => { e.stopPropagation(); goTo(currentIdx - 1); }} className="absolute left-3 p-2 rounded-full bg-white/10 text-white/70"><ChevronLeft className="w-6 h-6" /></button>}
            {hasNext && <button onClick={(e) => { e.stopPropagation(); goTo(currentIdx + 1); }} className="absolute right-3 p-2 rounded-full bg-white/10 text-white/70"><ChevronRight className="w-6 h-6" /></button>}
            <img src={lightboxUrl} alt="Hazard" className="max-w-full max-h-[85vh] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        );
      })()}
    </div>
  );
}

/**
 * FieldCrewApp — Offline-capable PWA for field patrol crews
 * Spec-compliant layout: CrewHeader + Content + Bottom TabBar
 * Tabs: Tasks | Map | Reports
 */
import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import CrewHeader from "@/components/crew/CrewHeader";
import CrewTabBar, { type CrewTab } from "@/components/crew/CrewTabBar";
import CrewTasksView from "@/components/crew/CrewTasksView";
import CrewMapView from "@/components/crew/CrewMapView";
import CrewReportsView from "@/components/crew/CrewReportsView";

interface GpsPos { lat: number; lng: number; accuracy: number; timestamp: number }

interface HazardSubmission {
  id: string;
  type: string;
  description: string;
  submitted_at: Date;
  synced: boolean;
  photo_url?: string | null;
}

const PATROL_ID = "PATROL-2026-02-28-001";
const CIRCUIT_ID = "CKT-12A";

export default function FieldCrewApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [gps, setGps] = useState<GpsPos | null>(null);
  const [activeTab, setActiveTab] = useState<CrewTab>("tasks");
  const [queue, setQueue] = useState<HazardSubmission[]>([]);
  const watchRef = useRef<number | null>(null);

  // Network listeners
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none flex flex-col">
      {/* Sticky header */}
      <CrewHeader
        patrolId={PATROL_ID}
        circuitId={CIRCUIT_ID}
        online={online}
        unsyncedCount={queue.length}
        shiftStart="06:00"
        shiftEnd="14:00"
      />

      {/* Tab bar at top, below header */}
      <CrewTabBar active={activeTab} onChange={setActiveTab} />

      {/* Content area */}
      <main className={`flex-1 ${activeTab === "map" ? "" : "px-4 py-4 pb-20"} overflow-y-auto`}>
        {activeTab === "tasks" && (
          <CrewTasksView patrolId={PATROL_ID} onSwitchTab={setActiveTab} />
        )}
        {activeTab === "map" && (
          <CrewMapView gps={gps} patrolId={PATROL_ID} />
        )}
        {activeTab === "reports" && (
          <CrewReportsView gps={gps} online={online} queue={queue} setQueue={setQueue} />
        )}
      </main>

      {/* Sticky bottom action bar on Tasks tab */}
      {activeTab === "tasks" && (
        <div className="sticky bottom-0 z-30 bg-gray-950/95 backdrop-blur-sm border-t border-white/10 px-4 py-3">
          <button
            onClick={() => setActiveTab("reports")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-600 text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Hazard
          </button>
        </div>
      )}
    </div>
  );
}

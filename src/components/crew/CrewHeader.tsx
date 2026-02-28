import { Wifi, WifiOff, Info, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  patrolId: string;
  circuitId: string;
  online: boolean;
  unsyncedCount: number;
  shiftStart?: string;
  shiftEnd?: string;
}

export default function CrewHeader({ patrolId, circuitId, online, unsyncedCount, shiftStart, shiftEnd }: Props) {
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <header className="sticky top-0 z-40 bg-gray-950 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Patrol name */}
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/60 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">Patrol – {circuitId}</p>
              <p className="text-[10px] text-white/30 font-mono">{patrolId}</p>
            </div>
          </div>

          {/* Center: Time */}
          <div className="text-center hidden sm:block">
            <p className="text-sm font-mono text-white/60">{timeStr}</p>
            {shiftEnd && <p className="text-[9px] text-white/20">Shift ends {shiftEnd}</p>}
          </div>

          {/* Right: Connection status */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              online ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? "Online" : "Offline"}
              {unsyncedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px]">
                  {unsyncedCount}
                </span>
              )}
            </div>
            <button onClick={() => setShowInfo(!showInfo)} className="text-white/20 hover:text-white/50">
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Shift info sheet */}
      {showInfo && (
        <div className="bg-gray-900 border-b border-white/10 px-4 py-3 text-xs text-white/50 space-y-1">
          <p><span className="text-white/30">Patrol ID:</span> {patrolId}</p>
          <p><span className="text-white/30">Circuit:</span> {circuitId}</p>
          {shiftStart && <p><span className="text-white/30">Shift:</span> {shiftStart} – {shiftEnd || "TBD"}</p>}
          <button onClick={() => setShowInfo(false)} className="text-orange-400 text-[10px] mt-1">Close</button>
        </div>
      )}
    </>
  );
}

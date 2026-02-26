import { useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { Customer } from "@/lib/customer-types";
import { getSubstationForZip } from "@/lib/wildfire-utils";
import { getInfraForSubstation, LAYER_META, type InfraSegment } from "@/lib/infrastructure-data";
import { Layers, Eye, EyeOff, List, X } from "lucide-react";
import SafetyMapRenderer from "@/components/safety-map/SafetyMapRenderer";
import InfraListPanel from "@/components/safety-map/InfraListPanel";

interface Props {
  customer: Customer;
}

export default function AgentSafetyMapPanel({ customer }: Props) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ss = getSubstationForZip(customer.zip_code);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    undergrounded: true,
    hardened_pole: true,
    veg_completed: true,
    veg_planned: true,
    circuit: true,
  });
  const [showList, setShowList] = useState(false);

  const toggleLayer = (key: string) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const infra = getInfraForSubstation(ss?.id);

  const handleZoomTo = useCallback((seg: InfraSegment) => {
    const map = mapRef.current;
    if (!map) return;

    if (Array.isArray(seg.coords[0])) {
      const coords = seg.coords as [number, number][];
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 800 });
    } else {
      const coord = seg.coords as [number, number];
      map.flyTo({ center: coord, zoom: 16, duration: 800 });
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* Legend / Layer toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Layers className="w-3.5 h-3.5" />
          Layers
        </div>
        {[
          { key: "circuit", color: "#06B6D4", label: "Circuit" },
          ...Object.entries(LAYER_META).map(([key, m]) => ({ key, color: m.color, label: m.label })),
        ].map(({ key, color, label }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
              layers[key]
                ? "border-border bg-card text-foreground"
                : "border-transparent bg-muted/50 text-muted-foreground line-through"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, opacity: layers[key] ? 1 : 0.3 }} />
            {label}
            {layers[key] ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5" />}
          </button>
        ))}

        {/* Toggle list panel */}
        <button
          onClick={() => setShowList((v) => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ml-auto ${
            showList
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground"
          }`}
        >
          {showList ? <X className="w-3 h-3" /> : <List className="w-3 h-3" />}
          {showList ? "Close" : "List"}
        </button>
      </div>

      {/* Map + optional side panel */}
      <div className="flex gap-3">
        <div className={showList ? "flex-1 min-w-0" : "w-full"}>
          <SafetyMapRenderer customer={customer} substation={ss} layers={layers} mapRef={mapRef} />
        </div>
        {showList && (
          <div className="w-72 flex-shrink-0">
            <InfraListPanel segments={infra} onZoomTo={handleZoomTo} />
          </div>
        )}
      </div>

      {/* Stats strip */}
      {ss && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Undergrounded", value: `${infra.filter(s => s.type === "undergrounded").length} segments`, color: "#22C55E" },
            { label: "Hardened Poles", value: `${infra.filter(s => s.type === "hardened_pole").length} poles`, color: "#3B82F6" },
            { label: "Veg Cleared", value: `${infra.filter(s => s.type === "veg_completed").length} zones`, color: "#A3E635" },
            { label: "Veg Planned", value: `${infra.filter(s => s.type === "veg_planned").length} zones`, color: "#FACC15" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stat.color }} />
              <span className="text-muted-foreground">{stat.label}</span>
              <span className="ml-auto font-semibold text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

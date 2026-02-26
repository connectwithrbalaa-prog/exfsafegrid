import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Customer } from "@/lib/customer-types";
import { getSubstationForZip, type Substation } from "@/lib/wildfire-utils";
import { Layers, Eye, EyeOff } from "lucide-react";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

/* ── Mock infrastructure data keyed by substation id ─────── */

interface InfraSegment {
  id: string;
  type: "undergrounded" | "hardened_pole" | "veg_completed" | "veg_planned";
  label: string;
  coords: [number, number][] | [number, number]; // line or point
}

const INFRA_BY_SS: Record<string, InfraSegment[]> = {
  "SS-201": [
    { id: "ug-1", type: "undergrounded", label: "Page Mill Rd Underground (2.1 mi)", coords: [[-122.16, 37.42], [-122.13, 37.43]] },
    { id: "hp-1", type: "hardened_pole", label: "Pole #A-4412 – Strengthened", coords: [-122.145, 37.435] },
    { id: "hp-2", type: "hardened_pole", label: "Pole #A-4419 – Strengthened", coords: [-122.138, 37.438] },
    { id: "vc-1", type: "veg_completed", label: "Arastradero Veg Clear (0.8 mi)", coords: [[-122.17, 37.39], [-122.155, 37.395]] },
    { id: "vp-1", type: "veg_planned", label: "Foothill Expwy Veg (Q3 2026)", coords: [[-122.12, 37.44], [-122.10, 37.45]] },
  ],
  "SS-202": [
    { id: "ug-2", type: "undergrounded", label: "Stevens Creek Underground (1.4 mi)", coords: [[-121.91, 37.32], [-121.89, 37.34]] },
    { id: "hp-3", type: "hardened_pole", label: "Pole #B-2205 – Strengthened", coords: [-121.90, 37.33] },
    { id: "vc-2", type: "veg_completed", label: "Saratoga Hills Veg Clear (1.1 mi)", coords: [[-121.93, 37.30], [-121.91, 37.31]] },
    { id: "vp-2", type: "veg_planned", label: "Prospect Rd Veg (Q4 2026)", coords: [[-121.88, 37.35], [-121.87, 37.36]] },
  ],
  "SS-101": [
    { id: "ug-3", type: "undergrounded", label: "Sierra Vista Underground (1.8 mi)", coords: [[-119.30, 37.24], [-119.27, 37.26]] },
    { id: "hp-4", type: "hardened_pole", label: "Pole #N-1102 – Strengthened", coords: [-119.28, 37.25] },
    { id: "vc-3", type: "veg_completed", label: "Bass Lake Veg Clear (2.3 mi)", coords: [[-119.32, 37.22], [-119.29, 37.23]] },
    { id: "vp-3", type: "veg_planned", label: "Road 200 Veg (Q2 2026)", coords: [[-119.25, 37.27], [-119.23, 37.28]] },
  ],
  "SS-103": [
    { id: "ug-4", type: "undergrounded", label: "South Ridge Blvd Underground (1.5 mi)", coords: [[-119.04, 35.36], [-119.01, 35.38]] },
    { id: "hp-5", type: "hardened_pole", label: "Pole #S-3301 – Strengthened", coords: [-119.02, 35.37] },
    { id: "hp-6", type: "hardened_pole", label: "Pole #S-3318 – Strengthened", coords: [-119.00, 35.38] },
    { id: "vc-4", type: "veg_completed", label: "Kern River Rd Veg Clear (1.9 mi)", coords: [[-119.06, 35.35], [-119.03, 35.36]] },
    { id: "vp-4", type: "veg_planned", label: "Bakersfield Connector Veg (Q1 2027)", coords: [[-118.99, 35.39], [-118.97, 35.40]] },
  ],
  "SS-104": [
    { id: "ug-5", type: "undergrounded", label: "Foothill East Underground (1.2 mi)", coords: [[-119.24, 37.29], [-119.21, 37.31]] },
    { id: "hp-7", type: "hardened_pole", label: "Pole #F-4401 – Strengthened", coords: [-119.22, 37.30] },
    { id: "vc-5", type: "veg_completed", label: "Pine Flat Rd Veg Clear (1.6 mi)", coords: [[-119.26, 37.28], [-119.23, 37.29]] },
    { id: "vp-5", type: "veg_planned", label: "Trimmer Springs Veg (Q3 2026)", coords: [[-119.19, 37.32], [-119.17, 37.33]] },
  ],
  "SS-203": [
    { id: "ug-6", type: "undergrounded", label: "Mission St Underground (2.4 mi)", coords: [[-122.44, 37.75], [-122.41, 37.77]] },
    { id: "hp-8", type: "hardened_pole", label: "Pole #SF-7701 – Strengthened", coords: [-122.42, 37.76] },
    { id: "hp-9", type: "hardened_pole", label: "Pole #SF-7715 – Strengthened", coords: [-122.40, 37.77] },
    { id: "vc-6", type: "veg_completed", label: "Twin Peaks Veg Clear (0.9 mi)", coords: [[-122.45, 37.74], [-122.43, 37.75]] },
    { id: "vp-6", type: "veg_planned", label: "Glen Park Corridor Veg (Q4 2026)", coords: [[-122.39, 37.78], [-122.37, 37.79]] },
  ],
};

function getInfraForSubstation(ssId: string | undefined): InfraSegment[] {
  if (!ssId) return [];
  return INFRA_BY_SS[ssId] ?? generateDefault(ssId);
}

function generateDefault(ssId: string): InfraSegment[] {
  // Fallback: return empty; we only render known data
  return [];
}

/* ── Styles per infra type ──────────────────────────────── */

const LAYER_META: Record<InfraSegment["type"], { color: string; label: string; dash?: number[] }> = {
  undergrounded: { color: "#22C55E", label: "Undergrounded" },
  hardened_pole: { color: "#3B82F6", label: "Hardened Poles" },
  veg_completed: { color: "#A3E635", label: "Veg Mgmt – Done", dash: [2, 2] },
  veg_planned:   { color: "#FACC15", label: "Veg Mgmt – Planned", dash: [4, 4] },
};

interface Props {
  customer: Customer;
}

export default function AgentSafetyMapPanel({ customer }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ss = getSubstationForZip(customer.zip_code);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    undergrounded: true,
    hardened_pole: true,
    veg_completed: true,
    veg_planned: true,
    circuit: true,
  });

  const toggleLayer = (key: string) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const center: [number, number] = ss
      ? [ss.longitude, ss.latitude]
      : [-119.3, 37.2];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center,
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      /* ── Customer marker ──────────────────────── */
      const custEl = document.createElement("div");
      custEl.className = "customer-marker";
      custEl.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,.6);";
      new mapboxgl.Marker({ element: custEl })
        .setLngLat(center)
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:12px;font-weight:600">${customer.name}</div>
           <div style="font-size:11px;color:#666">ZIP ${customer.zip_code}</div>`
        ))
        .addTo(map);

      /* ── Substation marker ────────────────────── */
      if (ss) {
        const ssEl = document.createElement("div");
        ssEl.style.cssText =
          "width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2px solid #fff;box-shadow:0 0 6px rgba(59,130,246,.5);";
        new mapboxgl.Marker({ element: ssEl })
          .setLngLat([ss.longitude, ss.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
            `<div style="font-size:12px;font-weight:600">${ss.name}</div>
             <div style="font-size:11px;color:#666">${ss.voltage} · ${ss.capacityMW} MW</div>`
          ))
          .addTo(map);
      }

      /* ── Circuit line (customer ↔ substation) ── */
      if (ss) {
        map.addSource("circuit-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                center,
                [ss.longitude, ss.latitude],
              ],
            },
          },
        });
        map.addLayer({
          id: "circuit-line",
          type: "line",
          source: "circuit-line",
          paint: {
            "line-color": "#06B6D4",
            "line-width": 2.5,
            "line-opacity": 0.8,
            "line-dasharray": [3, 2],
          },
        });
      }

      /* ── Infrastructure overlays ──────────────── */
      const infra = getInfraForSubstation(ss?.id);

      infra.forEach((seg) => {
        const meta = LAYER_META[seg.type];
        if (Array.isArray(seg.coords[0])) {
          // Line segment
          const coords = seg.coords as [number, number][];
          map.addSource(seg.id, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { label: seg.label },
              geometry: { type: "LineString", coordinates: coords },
            },
          });
          map.addLayer({
            id: seg.id,
            type: "line",
            source: seg.id,
            paint: {
              "line-color": meta.color,
              "line-width": 3,
              "line-opacity": 0.9,
              ...(meta.dash ? { "line-dasharray": meta.dash as any } : {}),
            },
          });
        } else {
          // Point
          const coord = seg.coords as [number, number];
          const el = document.createElement("div");
          el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${meta.color};border:2px solid #fff;box-shadow:0 0 4px ${meta.color}80;cursor:pointer;`;
          new mapboxgl.Marker({ element: el })
            .setLngLat(coord)
            .setPopup(new mapboxgl.Popup({ offset: 8 }).setHTML(
              `<div style="font-size:11px;font-weight:600">${seg.label}</div>
               <div style="font-size:10px;color:#666">${meta.label}</div>`
            ))
            .addTo(map);
        }
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Toggle layer visibility on the live map ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const infra = getInfraForSubstation(ss?.id);
    infra.forEach((seg) => {
      if (map.getLayer(seg.id)) {
        const visible = layers[seg.type] ? "visible" : "none";
        map.setLayoutProperty(seg.id, "visibility", visible);
      }
    });

    if (map.getLayer("circuit-line")) {
      map.setLayoutProperty("circuit-line", "visibility", layers.circuit ? "visible" : "none");
    }
  }, [layers, ss?.id]);

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
      </div>

      {/* Map */}
      <div ref={mapContainer} className="w-full h-[420px] rounded-xl border border-border" />

      {/* Stats strip */}
      {ss && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Undergrounded", value: `${getInfraForSubstation(ss.id).filter(s => s.type === "undergrounded").length} segments`, color: "#22C55E" },
            { label: "Hardened Poles", value: `${getInfraForSubstation(ss.id).filter(s => s.type === "hardened_pole").length} poles`, color: "#3B82F6" },
            { label: "Veg Cleared", value: `${getInfraForSubstation(ss.id).filter(s => s.type === "veg_completed").length} zones`, color: "#A3E635" },
            { label: "Veg Planned", value: `${getInfraForSubstation(ss.id).filter(s => s.type === "veg_planned").length} zones`, color: "#FACC15" },
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

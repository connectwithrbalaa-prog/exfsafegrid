import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Customer } from "@/lib/customer-types";
import type { Substation } from "@/lib/wildfire-utils";
import { getInfraForSubstation, LAYER_META, type InfraSegment } from "@/lib/infrastructure-data";
import { MAPBOX_STYLE, NAV_CONTROL_POSITION, initMapbox } from "@/lib/mapbox-config";

/* ── Build rich popup HTML for a segment ── */
function buildPopupHTML(seg: InfraSegment): string {
  const meta = LAYER_META[seg.type];
  const m = seg.meta;

  let rows = "";
  const addRow = (label: string, value: string | undefined) => {
    if (!value) return;
    rows += `<tr><td style="color:#888;padding:2px 8px 2px 0;white-space:nowrap">${label}</td><td style="font-weight:500">${value}</td></tr>`;
  };

  addRow("Status", m?.status);
  addRow("Work Order", m?.workOrderId);
  addRow("Contractor", m?.contractor);
  if (m?.lengthMi) addRow("Length", `${m.lengthMi} mi`);
  addRow("Completed", m?.completedDate);
  addRow("Next Inspection", m?.nextInspection);

  const notesHtml = m?.notes
    ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,.05);border-radius:4px;font-size:10px;color:#555;line-height:1.4">${m.notes}</div>`
    : "";

  return `
    <div style="min-width:220px;max-width:300px;font-family:system-ui,sans-serif;font-size:11px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${meta.color};flex-shrink:0"></span>
        <span style="font-size:12px;font-weight:700">${seg.label}</span>
      </div>
      <div style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${meta.color}22;color:${meta.color};margin-bottom:6px">${meta.icon} ${meta.label}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">${rows}</table>
      ${notesHtml}
    </div>
  `;
}

interface Props {
  customer: Customer;
  substation: Substation | undefined;
  layers: Record<string, boolean>;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
}

export default function SafetyMapRenderer({ customer, substation: ss, layers, mapRef }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    initMapbox();

    const center: [number, number] = ss
      ? [ss.longitude, ss.latitude]
      : [-119.3, 37.2];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLE,
      center,
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      /* Customer marker */
      const custEl = document.createElement("div");
      custEl.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,.6);";
      new mapboxgl.Marker({ element: custEl })
        .setLngLat(center)
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:12px;font-weight:600">${customer.name}</div>
           <div style="font-size:11px;color:#666">ZIP ${customer.zip_code}</div>`
        ))
        .addTo(map);

      /* Substation marker */
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

      /* Circuit line */
      if (ss) {
        map.addSource("circuit-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [center, [ss.longitude, ss.latitude]],
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

      /* Infrastructure overlays */
      const infra = getInfraForSubstation(ss?.id);

      infra.forEach((seg) => {
        const meta = LAYER_META[seg.type];
        if (Array.isArray(seg.coords[0])) {
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

          /* Click-to-inspect on line segments */
          map.on("click", seg.id, (e) => {
            const lngLat = e.lngLat;
            new mapboxgl.Popup({ offset: 10, maxWidth: "320px" })
              .setLngLat(lngLat)
              .setHTML(buildPopupHTML(seg))
              .addTo(map);
          });

          /* Pointer cursor on hover */
          map.on("mouseenter", seg.id, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", seg.id, () => {
            map.getCanvas().style.cursor = "";
          });
        } else {
          /* Point markers with rich popup */
          const coord = seg.coords as [number, number];
          const el = document.createElement("div");
          el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${meta.color};border:2px solid #fff;box-shadow:0 0 4px ${meta.color}80;cursor:pointer;`;
          new mapboxgl.Marker({ element: el })
            .setLngLat(coord)
            .setPopup(new mapboxgl.Popup({ offset: 8, maxWidth: "320px" }).setHTML(buildPopupHTML(seg)))
            .addTo(map);
        }
      });

      map.addControl(new mapboxgl.NavigationControl(), NAV_CONTROL_POSITION);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Toggle layer visibility */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const infra = getInfraForSubstation(ss?.id);
    infra.forEach((seg) => {
      if (map.getLayer(seg.id)) {
        map.setLayoutProperty(seg.id, "visibility", layers[seg.type] ? "visible" : "none");
      }
    });

    if (map.getLayer("circuit-line")) {
      map.setLayoutProperty("circuit-line", "visibility", layers.circuit ? "visible" : "none");
    }
  }, [layers, ss?.id]);

  return <div ref={mapContainer} className="w-full h-[420px] rounded-xl border border-border" />;
}

import { useEffect, useState, useRef } from "react";
import { useActiveIncidents, useCurrentPerimeters } from "@/hooks/use-api";
import { Flame, RefreshCw, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_STYLE, NAV_CONTROL_POSITION, initMapbox } from "@/lib/mapbox-config";
import type { Incident } from "@/lib/api-types";

interface Props {
  customerZip?: string;
  compact?: boolean;
}

function getAcresColor(acres: number | null): string {
  if (!acres || acres < 100) return "#FFD700";
  if (acres <= 1000) return "#FF8C00";
  return "#FF0000";
}

function getAcresRadius(acres: number | null): number {
  if (!acres || acres <= 0) return 4;
  if (acres <= 100) return 6;
  if (acres <= 1000) return 10;
  if (acres <= 10000) return 14;
  return 18;
}

function CollapsibleTable({ incidents, compact }: { incidents: Incident[]; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const displayed = incidents.slice(0, compact ? 10 : 30);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground"
      >
        <span>Active Incidents ({incidents.length})</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className={`${compact ? "max-h-40" : "max-h-56"} overflow-y-auto`}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Name</th>
                <th className="px-3 py-1.5 font-medium">State</th>
                <th className="px-3 py-1.5 font-medium">Acres</th>
                <th className="px-3 py-1.5 font-medium">Containment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map((inc) => (
                <tr key={inc.incident_id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-1.5 text-card-foreground font-medium">{inc.incident_name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{inc.state}</td>
                  <td className="px-3 py-1.5 text-card-foreground font-medium">
                    {inc.acres_burned ? inc.acres_burned.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {inc.containment_pct != null ? `${inc.containment_pct}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WildfireMap({ customerZip, compact = false }: Props) {
  const { data: incidentsData, isLoading, isError, error, refetch } = useActiveIncidents({ min_acres: 100 });
  const { data: perimetersData } = useCurrentPerimeters({ min_acres: 100 });

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const incidents = incidentsData?.incidents ?? [];

  // Build a perimeter lookup for popup metadata
  const perimeterMap = new Map(
    (perimetersData?.perimeters ?? []).map((p) => [p.incident_id, p])
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    initMapbox();

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAPBOX_STYLE,
      center: [-120, 37.5],
      zoom: 6,
    });

    map.addControl(new mapboxgl.NavigationControl(), NAV_CONTROL_POSITION);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when incident data changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const display = incidents.filter((i) => i.latitude != null && i.longitude != null);

    display.forEach((inc) => {
      const r = getAcresRadius(inc.acres_burned);
      const color = getAcresColor(inc.acres_burned);
      const perim = perimeterMap.get(inc.incident_id);

      const el = document.createElement("div");
      el.style.width = `${r * 2}px`;
      el.style.height = `${r * 2}px`;
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.opacity = "0.75";
      el.style.border = `1px solid ${color}`;
      el.style.cursor = "pointer";

      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setHTML(
        `<div style="font-size:11px;line-height:1.5;color:#222">
          <b>${inc.incident_name}</b><br/>
          <b>State:</b> ${inc.state}<br/>
          <b>Acres:</b> ${inc.acres_burned?.toLocaleString() ?? "—"}<br/>
          <b>Containment:</b> ${inc.containment_pct != null ? inc.containment_pct + "%" : "—"}<br/>
          ${perim ? `<b>GIS Acres:</b> ${perim.gis_acres?.toLocaleString() ?? "—"}<br/>` : ""}
          ${inc.cause ? `<b>Cause:</b> ${inc.cause}<br/>` : ""}
          <b>Lat:</b> ${inc.latitude!.toFixed(4)}<br/>
          <b>Lng:</b> ${inc.longitude!.toFixed(4)}
        </div>`
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([inc.longitude!, inc.latitude!])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    if (display.length > 0) {
      const avgLat = display.reduce((s, f) => s + f.latitude!, 0) / display.length;
      const avgLng = display.reduce((s, f) => s + f.longitude!, 0) / display.length;
      mapRef.current.flyTo({ center: [avgLng, avgLat], zoom: 6 });
    }
  }, [incidents, perimetersData]);

  const highIntensity = incidents.filter((i) => (i.acres_burned ?? 0) > 1000).length;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[450px] w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 p-3 border-b border-border bg-muted/30">
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Active Incidents</div>
            <div className="text-xl font-bold text-card-foreground">{incidents.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Large (&gt;1k acres)</div>
            <div className="text-xl font-bold text-destructive">{highIntensity}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Perimeters Tracked</div>
            <div className="text-sm font-semibold text-card-foreground">{perimetersData?.perimeters?.length ?? 0}</div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-card-foreground">Live Wildfire Activity</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">Active wildfire incidents from NIFC via FastAPI backend. Shows incidents ≥100 acres.</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
              {incidents.length} active {incidents.length === 1 ? "incident" : "incidents"}
            </span>
          </div>
          <button onClick={() => refetch()} className="p-1 rounded hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 450 }} className="relative w-full">
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 border border-border rounded-md px-3 py-2 text-[10px] space-y-1">
            <div className="font-semibold text-card-foreground mb-1">Acres Burned</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFD700" }} />
              <span className="text-muted-foreground">&lt; 100</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF8C00" }} />
              <span className="text-muted-foreground">100 – 1,000</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF0000" }} />
              <span className="text-muted-foreground">&gt; 1,000</span>
            </div>
          </div>
        </div>

        {isError && (
          <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Failed to load incidents: {(error as Error).message}
          </div>
        )}

        {/* Collapsible Table */}
        {incidents.length > 0 && (
          <CollapsibleTable incidents={incidents} compact={compact} />
        )}

        {incidents.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No active incidents matching filter criteria.
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex justify-between">
          <span>Source: NIFC Active Incidents (via FastAPI)</span>
          <span>{incidents.length} incidents, {perimetersData?.perimeters?.length ?? 0} perimeters</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

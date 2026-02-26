import type { InfraSegment } from "@/lib/infrastructure-data";
import { LAYER_META } from "@/lib/infrastructure-data";
import { MapPin, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  segments: InfraSegment[];
  onZoomTo: (seg: InfraSegment) => void;
}

export default function InfraListPanel({ segments, onZoomTo }: Props) {
  // Group by type
  const grouped = segments.reduce<Record<string, InfraSegment[]>>((acc, seg) => {
    (acc[seg.type] ??= []).push(seg);
    return acc;
  }, {});

  const typeOrder: InfraSegment["type"][] = ["undergrounded", "hardened_pole", "veg_completed", "veg_planned"];

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          Infrastructure Segments
          <span className="ml-auto text-muted-foreground font-normal">{segments.length} items</span>
        </h4>
      </div>

      <ScrollArea className="h-[380px]">
        <div className="p-2 space-y-3">
          {typeOrder.map((type) => {
            const items = grouped[type];
            if (!items?.length) return null;
            const meta = LAYER_META[type];

            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: meta.color }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
                </div>

                <div className="space-y-1">
                  {items.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => onZoomTo(seg)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: meta.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-foreground truncate">
                            {seg.label}
                          </div>
                          {seg.meta && (
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              {seg.meta.status && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: seg.meta.status === "Complete" ? `${meta.color}18` : "hsl(var(--muted))",
                                    color: seg.meta.status === "Complete" ? meta.color : undefined,
                                  }}
                                >
                                  {seg.meta.status}
                                </span>
                              )}
                              {seg.meta.workOrderId && (
                                <span className="font-mono">{seg.meta.workOrderId}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {segments.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No infrastructure data for this substation.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

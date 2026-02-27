import { FlaskConical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DemoBadgeProps {
  className?: string;
  label?: string;
}

export default function DemoBadge({ className = "", label = "Synthetic fallback data — live backend unavailable" }: DemoBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20 select-none ${className}`}
          >
            <FlaskConical className="w-3 h-3" />
            Demo
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

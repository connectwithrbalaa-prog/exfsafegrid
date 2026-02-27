import { cn } from "@/lib/utils";

interface DriverChipsProps {
  drivers: string | null;
  className?: string;
}

export default function DriverChips({ drivers, className }: DriverChipsProps) {
  if (!drivers) return <span className="text-muted-foreground text-xs">—</span>;

  const chips = drivers
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  if (chips.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

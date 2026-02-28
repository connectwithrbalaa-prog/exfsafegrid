interface Props {
  priority: 1 | 2 | 3 | 4;
  reason?: string;
}

const PRIORITY_CONFIG = {
  1: { label: "P1", text: "Critical – respond immediately", bg: "bg-red-600", border: "border-red-500" },
  2: { label: "P2", text: "High – complete as soon as possible", bg: "bg-orange-600", border: "border-orange-500" },
  3: { label: "P3", text: "Moderate – scheduled patrol", bg: "bg-yellow-600", border: "border-yellow-500" },
  4: { label: "P4", text: "Low – routine inspection", bg: "bg-blue-600", border: "border-blue-500" },
} as const;

export default function CrewPriorityBanner({ priority, reason }: Props) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <div className={`${cfg.bg}/20 border ${cfg.border}/30 rounded-lg px-4 py-3`}>
      <div className="flex items-center gap-3">
        <span className={`${cfg.bg} text-white text-xs font-bold px-2.5 py-1 rounded-md`}>{cfg.label}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{cfg.text}</p>
          {reason && <p className="text-[11px] text-white/40 mt-0.5 truncate">{reason}</p>}
        </div>
      </div>
    </div>
  );
}

import { ClipboardList, Map, FileText } from "lucide-react";

export type CrewTab = "tasks" | "map" | "reports";

interface Props {
  active: CrewTab;
  onChange: (tab: CrewTab) => void;
}

const TABS: { id: CrewTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "map", label: "Map", icon: Map },
  { id: "reports", label: "Reports", icon: FileText },
];

export default function CrewTabBar({ active, onChange }: Props) {
  return (
    <nav className="sticky top-0 z-30 bg-gray-950 border-b border-white/10">
      <div className="flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              active === tab.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-white/25 hover:text-white/50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

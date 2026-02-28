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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950 border-t border-white/10 safe-area-bottom">
      <div className="flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
              active === tab.id
                ? "text-orange-400"
                : "text-white/25 active:text-white/50"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * CommandCenterLayout — Shared shell for EOC workspaces.
 * Renders persona selector tabs and an <Outlet /> for the active workspace.
 */
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Radio, BarChart3, Flame, Map, ClipboardList, Moon, Sun, RefreshCw, FileText, ArrowLeft } from "lucide-react";
import TopNav from "@/components/TopNav";
import { useDarkMode } from "@/hooks/use-dark-mode";

const WORKSPACES = [
  { key: "executive", label: "Executive", icon: BarChart3, path: "/command-center/executive" },
  { key: "wildfire", label: "Wildfire", icon: Flame, path: "/command-center/wildfire" },
  { key: "gis", label: "GIS", icon: Map, path: "/command-center/gis" },
  { key: "planning", label: "Planning", icon: ClipboardList, path: "/command-center/planning" },
] as const;

export default function CommandCenterLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dark, toggle } = useDarkMode();

  const activeKey = WORKSPACES.find((w) => pathname.startsWith(w.path))?.key ?? "executive";

  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)] text-[hsl(210,40%,93%)]">
      <TopNav variant="dark" />

      {/* Header */}
      <header className="border-b border-white/[0.08] bg-[hsl(220,25%,8%)]">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Wildfire Executive Command Center</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Situational Awareness · Asset Protection</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/docs")}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
            >
              <FileText className="w-3.5 h-3.5" />
              Docs
            </button>
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Tabs */}
      <div className="border-b border-white/[0.06] bg-[hsl(220,25%,7%)]">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1 py-2">
            {WORKSPACES.map((w) => (
              <button
                key={w.key}
                onClick={() => navigate(w.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeKey === w.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                <w.icon className="w-3.5 h-3.5" />
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workspace Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}

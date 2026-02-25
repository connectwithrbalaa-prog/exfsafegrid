import { useNavigate, useLocation } from "react-router-dom";
import { Home, Radio, Globe, FileText, Zap, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/command-center", label: "Command Center", icon: Radio },
  { to: "/status", label: "Status", icon: Globe },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/field-crew", label: "Field Crew", icon: HardHat },
];

interface TopNavProps {
  /** Use "dark" for dark-themed pages like Command Center */
  variant?: "light" | "dark";
}

export default function TopNav({ variant = "light" }: TopNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isDark = variant === "dark";

  return (
    <nav
      className={cn(
        "border-b",
        isDark
          ? "bg-[hsl(220,25%,8%)] border-white/[0.08]"
          : "bg-card border-border"
      )}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5"
        >
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="text-xs font-bold tracking-tight">
            <span className="text-exf-blue">Exf</span>
            <span className="text-exf-red">Safe</span>
            <span className="text-exf-blue">Grid</span>
          </span>
        </button>

        {/* Links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.to;
            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  isDark
                    ? isActive
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    : isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <link.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

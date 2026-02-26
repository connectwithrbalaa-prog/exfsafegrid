import { useNavigate, useLocation } from "react-router-dom";
import { Home, Radio, Globe, FileText, Zap, HardHat, User, Headset, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomer, type UserRole } from "@/hooks/use-customer";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  /** Which roles can see this link. Omit = visible to all. */
  roles?: UserRole[];
}

const NAV_LINKS: NavItem[] = [
  { to: "/customer", label: "My Portal", icon: User, roles: ["customer"] },
  { to: "/agent", label: "Agent Desk", icon: Headset, roles: ["agent"] },
  { to: "/command-center", label: "Command Center", icon: Radio, roles: ["agent", "executive"] },
  { to: "/field-crew", label: "Field Crew", icon: HardHat, roles: ["agent", "field"] },
  { to: "/status", label: "Status", icon: Globe },
  { to: "/docs", label: "Docs", icon: FileText },
];

interface TopNavProps {
  variant?: "light" | "dark";
}

export default function TopNav({ variant = "light" }: TopNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, setCustomer, setRole, setAgentEmail } = useCustomer();

  const isDark = variant === "dark";

  const visibleLinks = NAV_LINKS.filter((l) => !l.roles || l.roles.includes(role));

  const handleSignOut = () => {
    setCustomer(null);
    setRole("customer");
    setAgentEmail(null);
    navigate("/login");
  };

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
          {visibleLinks.map((link) => {
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

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ml-1",
              isDark
                ? "text-white/40 hover:text-white/70 hover:bg-white/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

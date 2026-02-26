import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomer, type UserRole } from "@/hooks/use-customer";
import { Zap } from "lucide-react";

const ROLE_HOME: Record<UserRole, string> = {
  customer: "/customer",
  agent: "/agent",
  executive: "/command-center",
  field: "/field-crew",
};

/**
 * Reads the active role from context and redirects to the correct persona home.
 * If no role is set, shows the role chooser (Index page handles that).
 */
export default function RoleRouter() {
  const { role, customer } = useCustomer();
  const navigate = useNavigate();

  useEffect(() => {
    const target = ROLE_HOME[role];
    if (target) {
      // For customer role, only redirect if a customer is selected
      if (role === "customer" && !customer) return;
      navigate(target, { replace: true });
    }
  }, [role, customer, navigate]);

  // Brief loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <Zap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    </div>
  );
}

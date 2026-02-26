import { Navigate } from "react-router-dom";
import { useCustomer, type UserRole } from "@/hooks/use-customer";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** If set, only users with this role can access the route */
  requiredRole?: UserRole;
}

/**
 * Guards persona routes. Uses the demo login context (useCustomer).
 * If no role is active, redirects to /login.
 * If a requiredRole is specified and doesn't match, redirects to /.
 */
export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { role, customer } = useCustomer();

  // No active session at all → login
  const hasSession = role === "customer" ? !!customer : !!role;
  if (!hasSession && requiredRole) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role for this route
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

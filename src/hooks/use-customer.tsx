import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Customer } from "@/lib/customer-types";

const STORAGE_KEY = "exfsafegrid_customer";
const ROLE_KEY = "exfsafegrid_role";
const AGENT_EMAIL_KEY = "exfsafegrid_agent_email";

export type UserRole = "customer" | "agent" | "executive" | "field";

interface CustomerCtx {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  agentEmail: string | null;
  setAgentEmail: (e: string | null) => void;
}

const Ctx = createContext<CustomerCtx>({ customer: null, setCustomer: () => {}, role: "customer", setRole: () => {}, agentEmail: null, setAgentEmail: () => {} });

function loadCustomer(): Customer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(loadCustomer);
  const [role, setRoleState] = useState<UserRole>(() => (localStorage.getItem(ROLE_KEY) as UserRole) || "customer");
  const [agentEmail, setAgentEmailState] = useState<string | null>(() => localStorage.getItem(AGENT_EMAIL_KEY));

  const setCustomer = useCallback((c: Customer | null) => {
    setCustomerState(c);
    if (c) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    localStorage.setItem(ROLE_KEY, r);
  }, []);

  const setAgentEmail = useCallback((e: string | null) => {
    setAgentEmailState(e);
    if (e) {
      localStorage.setItem(AGENT_EMAIL_KEY, e);
    } else {
      localStorage.removeItem(AGENT_EMAIL_KEY);
    }
  }, []);

  return <Ctx.Provider value={{ customer, setCustomer, role, setRole, agentEmail, setAgentEmail }}>{children}</Ctx.Provider>;
}

export function useCustomer() {
  return useContext(Ctx);
}

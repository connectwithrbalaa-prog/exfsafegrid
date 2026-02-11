import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Customer } from "@/lib/customer-types";

const STORAGE_KEY = "gridguard_customer";

interface CustomerCtx {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
}

const Ctx = createContext<CustomerCtx>({ customer: null, setCustomer: () => {} });

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

  const setCustomer = useCallback((c: Customer | null) => {
    setCustomerState(c);
    if (c) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return <Ctx.Provider value={{ customer, setCustomer }}>{children}</Ctx.Provider>;
}

export function useCustomer() {
  return useContext(Ctx);
}

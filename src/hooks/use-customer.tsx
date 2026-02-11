import { createContext, useContext, useState, ReactNode } from "react";
import type { Customer } from "@/lib/customer-types";

interface CustomerCtx {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
}

const Ctx = createContext<CustomerCtx>({ customer: null, setCustomer: () => {} });

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  return <Ctx.Provider value={{ customer, setCustomer }}>{children}</Ctx.Provider>;
}

export function useCustomer() {
  return useContext(Ctx);
}

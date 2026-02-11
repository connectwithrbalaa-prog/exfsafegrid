import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import type { Customer } from "@/lib/customer-types";
import { Zap, ChevronRight } from "lucide-react";

export default function Login() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCustomer } = useCustomer();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setCustomers(data as unknown as Customer[]);
        setLoading(false);
      });
  }, []);

  const pick = (c: Customer) => {
    setCustomer(c);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">GridGuard</h1>
          <p className="text-sm text-muted-foreground">Select a customer to view their dashboard</p>
        </div>

        {/* Customer list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading customers…</div>
          ) : (
            customers.map((c, i) => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary transition-colors ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ZIP {c.zip_code} · Fire Risk: {c.wildfire_risk} · {c.arrears_status === "Yes" ? `$${c.arrears_amount} past due` : "Current"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

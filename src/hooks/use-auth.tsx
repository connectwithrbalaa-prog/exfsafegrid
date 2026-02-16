import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "agent" | "customer" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.rpc("get_user_role", { _user_id: userId });
      setRole((data as AppRole) || "customer");
    } catch (e) {
      console.error("fetchRole failed:", e);
      setRole("customer");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Listener for ONGOING auth changes — never await inside this callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            if (isMounted) fetchRole(newSession.user.id);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    // INITIAL load — controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          await fetchRole(s.user.id);
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

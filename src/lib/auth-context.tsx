import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "teacher" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer role fetch to avoid deadlock inside auth callback
        setTimeout(() => fetchRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRoles(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const userRoles = (data ?? []).map((r) => r.role as AppRole);
    setRoles(userRoles);

    if (userRoles.includes("student")) {
      try {
        const { data: student } = await supabase
          .from("students")
          .select("id, status")
          .eq("user_id", uid)
          .single();

        // If the student exists and is pending approval, trigger the teacher notification.
        // The server function itself checks `approval_email_sent` to avoid duplicates.
        if (student && student.status === "pending_approval") {
          console.log("[Auth] Student pending approval, triggering teacher notification for:", student.id);
          const { notifyTeacherNewStudent } = await import("./email");
          await notifyTeacherNewStudent({
            data: {
              studentId: student.id,
            }
          });
        }
      } catch (err) {
        console.error("[Auth] Error checking/sending teacher notification:", err);
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import type { AppRole } from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";
import { roleHome } from "@/lib/roles";

export function RoleGate({ allow, children }: { allow: AppRole; children?: ReactNode }) {
  const { roles, loading, user } = useAuth();
  const navigate = useNavigate();
  const allowed = roles.includes(allow);

  useEffect(() => {
    if (loading || !user) return;
    if (roles.length === 0) return; // roles still loading (deferred fetch)
    if (!allowed) {
      navigate({ to: roleHome(roles[0]), replace: true });
    }
  }, [loading, user, roles, allowed, navigate]);

  if (loading || roles.length === 0 || !allowed) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}

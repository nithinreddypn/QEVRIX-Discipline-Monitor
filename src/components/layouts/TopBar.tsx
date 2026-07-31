import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { roleHome } from "@/lib/roles";
import type { AppRole } from "@/lib/auth-context";
import { SidebarTrigger } from "@/components/ui/sidebar";

function crumbs(pathname: string): { label: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Home" }];
  // Drop role prefix (student/teacher/admin); fall back to the segment itself.
  const rest = parts.slice(1).length ? parts.slice(1) : parts;
  return rest.map((p) => ({
    label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export function TopBar() {
  const { user, roles } = useAuth();
  const { resolved, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primaryRole = (roles.includes("admin") ? "admin" : roles.includes("teacher") ? "teacher" : "student") as AppRole;
  const home = roleHome(primaryRole);
  const trail = crumbs(pathname);

  const unread = useQuery({
    queryKey: ["topbar-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const notifPath =
    primaryRole === "admin" ? "/admin/notifications" :
    primaryRole === "teacher" ? "/teacher/notifications" : "/student/notifications";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {trail.map((c, i) => {
            const isLast = i === trail.length - 1;
            return (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                {isLast ? (
                  <span className="font-semibold text-foreground">{c.label}</span>
                ) : (
                  <Link to={home} className="font-medium text-muted-foreground transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <Link
          to={notifPath}
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread.data! > 9 ? "9+" : unread.data}
            </span>
          )}
        </Link>
        <button
          onClick={toggle}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Toggle theme"
        >
          {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, Bell, Building2, ChevronsUpDown, ClipboardList,
  FileBarChart, GraduationCap, LayoutDashboard, LineChart, LogOut, Settings,
  ShieldCheck, Sliders, UserCheck, UserRound, Users, UsersRound,
} from "lucide-react";

import type { ComponentType } from "react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

type NavGroup = { label: string; items: NavItem[] };

function useStudentGroups(): NavGroup[] {
  return [
    { label: "Overview", items: [
      { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/student/history", label: "Detection History", icon: Activity },
      { to: "/student/notifications", label: "Notifications", icon: Bell },
    ]},
    { label: "Me", items: [
      { to: "/student/profile", label: "My Profile", icon: UserRound },
    ]},
  ];
}

function useTeacherGroups(): NavGroup[] {
  const { user } = useAuth();
  const pending = useQuery({
    queryKey: ["teacher-pending-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("branch_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const q = supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval");
        
      if (teacher?.branch_id) {
        q.eq("branch_id", teacher.branch_id);
      }
      
      const { count } = await q;
      return count ?? 0;
    },
  });
  return [
    { label: "Overview", items: [
      { to: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ]},
    { label: "Classroom", items: [
      { to: "/teacher/students", label: "Students", icon: Users },
      { to: "/teacher/approvals", label: "Pending Approvals", icon: UserCheck, badge: pending.data },
      { to: "/teacher/records", label: "Detection Records", icon: ClipboardList },
    ]},
    { label: "Insights", items: [
      { to: "/teacher/analytics", label: "Analytics", icon: LineChart },
      { to: "/teacher/notifications", label: "Notifications", icon: Bell },
    ]},
    { label: "Me", items: [
      { to: "/teacher/profile", label: "Profile", icon: UserRound },
    ]},
  ];
}

function useAdminGroups(): NavGroup[] {
  const pending = useQuery({
    queryKey: ["admin-pending-approvals-count"],
    queryFn: async () => {
      const [tCount, sCount] = await Promise.all([
        supabase
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval"),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval"),
      ]);
      return (tCount.count ?? 0) + (sCount.count ?? 0);
    },
  });
  return [
    { label: "Overview", items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ]},
    { label: "People", items: [
      { to: "/admin/students", label: "Students", icon: GraduationCap },
      { to: "/admin/teachers", label: "Teachers", icon: UsersRound },
      { to: "/admin/approvals", label: "Pending Approvals", icon: UserCheck, badge: pending.data },
      { to: "/admin/branches", label: "Branches", icon: Building2 },
    ]},
    { label: "Monitoring", items: [
      { to: "/admin/detections", label: "Detection History", icon: Activity },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/reports", label: "Reports", icon: FileBarChart },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ]},
    { label: "System", items: [
      { to: "/admin/settings", label: "Settings", icon: Sliders },
    ]},
  ];
}


export function AppSidebar() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primaryRole =
    roles.includes("admin") ? "admin" :
    roles.includes("teacher") ? "teacher" : "student";
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const studentGroups = useStudentGroups();
  const teacherGroups = useTeacherGroups();
  const adminGroups = useAdminGroups();
  const groups =
    primaryRole === "admin" ? adminGroups :
    primaryRole === "teacher" ? teacherGroups : studentGroups;

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const initial = (user?.email?.[0] ?? "U").toUpperCase();
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Account";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[13px] font-semibold tracking-tight">
                QEVRIX
              </div>
              <div className="truncate text-[10.5px] text-muted-foreground">
                Discipline Monitor
              </div>
            </div>
          )}
          <SidebarTrigger className="h-7 w-7" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={collapsed ? item.label : undefined}
                        className={[
                          "relative h-9 rounded-md text-[13px] font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                            : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                        ].join(" ")}
                      >
                        <Link to={item.to}>
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          <item.icon className={active ? "text-primary" : ""} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge != null && item.badge > 0 && !collapsed && (
                            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {initial}
            </span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{displayName}</div>
                  <div className="mt-0.5 inline-flex rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent-foreground">
                    {primaryRole}
                  </div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Signed in as
              <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                {user?.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/preferences"><Sliders className="mr-2 h-4 w-4" /> Preferences</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

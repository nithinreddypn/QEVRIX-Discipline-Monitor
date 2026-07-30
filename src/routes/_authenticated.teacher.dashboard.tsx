import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, ScanLine, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

export const Route = createFileRoute("/_authenticated/teacher/dashboard")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard — QEVRIX" },
      { name: "description", content: "Teacher discipline monitoring workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherDashboard,
});

type Recent = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
  student_name: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function TeacherDashboard() {
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ["teacher-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = startOfToday();
      
      // Fetch teacher's branch_id first to filter students
      const { data: teacher } = await supabase
        .from("teachers")
        .select("branch_id")
        .eq("user_id", user!.id)
        .single();
      const branchId = teacher?.branch_id;

      const studentsQuery = supabase
        .from("students")
        .select("id", { count: "exact", head: true });
      if (branchId) {
        studentsQuery.eq("branch_id", branchId);
      }

      const [studentsRes, noIdRes, notifRes] = await Promise.all([
        studentsQuery,
        supabase
          .from("detections")
          .select("id", { count: "exact", head: true })
          .gte("detection_time", since)
          .eq("id_card_found", false),
        supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      return {
        totalStudents: studentsRes.count ?? 0,
        noId: noIdRes.count ?? 0,
        notifications: notifRes.count ?? 0,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["teacher-recent", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Recent[]> => {
      // Fetch teacher's branch_id
      const { data: teacher } = await supabase
        .from("teachers")
        .select("branch_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const branchId = teacher?.branch_id;

      if (!branchId) return [];

      const { data } = await (supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status, student_name") as any)
        .eq("branch_id", branchId)
        .eq("is_repeat", false)
        .order("detection_time", { ascending: false })
        .limit(8);
      return (data as Recent[] | null) ?? [];
    },
  });

  const recentCount = recent.data?.length ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Teacher
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Branch overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discipline monitoring and student analytics.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<ScanLine className="h-4 w-4" />} label="Total Students" value={stats.data?.totalStudents ?? "—"} />
        <StatCard icon={<UserX className="h-4 w-4" />} label="Without ID" value={stats.data?.noId ?? "—"} tone="amber" />
        <StatCard icon={<Bell className="h-4 w-4" />} label="Notifications" value={stats.data?.notifications ?? "—"} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Recent Activity" value={recentCount} />
      </div>

      <section className="card-surface p-0">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">Recent activity</h2>
          <span className="text-xs text-muted-foreground">Latest detections in your branch</span>
        </header>
        {recent.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : recentCount === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No recent activity.</div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.data!.map((r) => {
              const d = new Date(r.detection_time);
              return (
                <li key={r.id} className="flex items-center gap-4 px-6 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <ScanLine className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {r.student_name ?? "Unknown student"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <YesNoBadge yes={r.id_card_found} />
                  <StatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "default" | "amber";
}) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-center gap-2">
        <span
          className={[
            "grid h-8 w-8 place-items-center rounded-lg",
            tone === "amber" ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary",
          ].join(" ")}
        >
          {icon}
        </span>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, ScanLine, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — QEVRIX" },
      { name: "description", content: "Institution-wide discipline overview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

type Recent = {
  id: string;
  detection_time: string;
  student_name: string | null;
  id_card_found: boolean;
  status: string | null;
  branches: { code: string | null; name: string | null } | null;
};

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const iso = startOfDay.toISOString();
      const [students, todays, noId, unknown, notifs] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("detections").select("id", { count: "exact", head: true }).gte("detection_time", iso),
        supabase.from("detections").select("id", { count: "exact", head: true }).gte("detection_time", iso).eq("id_card_found", false),
        supabase.from("detections").select("id", { count: "exact", head: true }).gte("detection_time", iso).is("student_id", null),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      ]);
      return {
        students: students.count ?? 0,
        todays: todays.count ?? 0,
        noId: noId.count ?? 0,
        unknown: unknown.count ?? 0,
        notifs: notifs.count ?? 0,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["admin-recent"],
    queryFn: async (): Promise<Recent[]> => {
      const { data } = await (supabase
        .from("detections")
        .select("id, detection_time, student_name, id_card_found, status, branches(code, name)") as any)
        .eq("is_repeat", false)
        .order("detection_time", { ascending: false })
        .limit(10);
      return (data as unknown as Recent[] | null) ?? [];
    },
  });

  const cards = [
    { label: "Total Students", value: stats.data?.students, icon: Users },
    { label: "Today's Detections", value: stats.data?.todays, icon: ScanLine },
    { label: "Without ID (today)", value: stats.data?.noId, icon: UserRound, tone: "amber" as const },
    { label: "Unknown Persons (today)", value: stats.data?.unknown, icon: Activity, tone: "amber" as const },
    { label: "Unread Notifications", value: stats.data?.notifs, icon: Bell },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Control room
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Institution-wide visibility across every branch, teacher and student.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              <span
                className={[
                  "grid h-8 w-8 place-items-center rounded-lg",
                  c.tone === "amber"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-primary/10 text-primary",
                ].join(" ")}
              >
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 font-display text-3xl font-semibold tracking-tight tabular-nums">
              {stats.isLoading ? "—" : c.value ?? 0}
            </div>
          </div>
        ))}
      </div>

      <section className="card-surface p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Recent activity</h2>
            <p className="text-xs text-muted-foreground">Latest detections across all branches.</p>
          </div>
          <Link to="/admin/detections" className="text-xs font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>
        {recent.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (recent.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No detections yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Branch</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {(recent.data ?? []).map((r) => {
                  const d = new Date(r.detection_time);
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30">
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">
                        {d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-foreground">{r.student_name ?? "Unknown"}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{r.branches?.code ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-3.5"><YesNoBadge yes={r.id_card_found} /></td>
                      <td className="whitespace-nowrap px-6 py-3.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

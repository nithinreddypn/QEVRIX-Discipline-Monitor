import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, CheckCircle2, Clock, GraduationCap, Hourglass, Mail, Phone, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/student/StatusBadge";
import { useStudentRecord } from "@/lib/student-status";

export const Route = createFileRoute("/_authenticated/student/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — QEVRIX" },
      { name: "description", content: "Your daily discipline status at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDashboard,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function StudentDashboard() {
  const { user } = useAuth();
  const student = useStudentRecord();

  if (student.isLoading) return <DashboardSkeleton />;

  const status = student.data?.status;

  if (status === "pending_approval") {
    return <PendingCard rec={student.data!} />;
  }
  if (status === "rejected") {
    return <RejectedCard rec={student.data!} />;
  }

  return <ActiveDashboard userId={user?.id} />;
}

function PendingCard({ rec }: { rec: NonNullable<ReturnType<typeof useStudentRecord>["data"]> }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-amber-50 px-6 py-5 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Hourglass className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">
                Your profile is pending approval
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your branch teacher will review your details shortly. You'll be notified when the review is complete.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your submitted details
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReadRow label="Full name" value={rec.full_name} />
            <ReadRow label="USN" value={rec.usn} mono />
            <ReadRow label="Branch" value={rec.branch?.code ? `${rec.branch.code} — ${rec.branch.name}` : "—"} />
            <ReadRow label="Semester" value={rec.semester ? `Semester ${rec.semester}` : "—"} />
            <ReadRow label="Email" value={rec.email ?? "—"} />
            <ReadRow label="Phone" value={rec.phone ?? "—"} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function RejectedCard({ rec }: { rec: NonNullable<ReturnType<typeof useStudentRecord>["data"]> }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-destructive/5 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">Your signup was rejected</h1>
              {rec.rejection_reason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Reason: <span className="text-foreground">{rec.rejection_reason}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 text-sm text-muted-foreground">
          If you think this is a mistake, please contact the admin at{" "}
          <a href="mailto:admin@qevrix.app" className="font-medium text-primary hover:underline">admin@qevrix.app</a>.
        </div>
      </div>
    </div>
  );
}

function ReadRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={["mt-1 text-sm text-foreground", mono ? "font-mono" : ""].join(" ")}>{value}</dd>
    </div>
  );
}

function ActiveDashboard({ userId }: { userId: string | undefined }) {
  const nameQ = useQuery({
    queryKey: ["profile-name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId!).maybeSingle();
      return data?.full_name ?? "Student";
    },
  });

  const todayQ = useQuery({
    queryKey: ["today-detection", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("detections")
        .select("detection_time, id_card_found, status")
        .gte("detection_time", startOfToday())
        .order("detection_time", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const weekQ = useQuery({
    queryKey: ["week-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { count } = await supabase.from("detections").select("id", { count: "exact", head: true }).gte("detection_time", since.toISOString());
      return count ?? 0;
    },
  });

  const flaggedQ = useQuery({
    queryKey: ["flagged-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { count } = await supabase.from("detections").select("id", { count: "exact", head: true }).gte("detection_time", since.toISOString()).eq("id_card_found", false);
      return count ?? 0;
    },
  });

  const unreadQ = useQuery({
    queryKey: ["unread-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
      return count ?? 0;
    },
  });

  const recentQ = useQuery({
    queryKey: ["student-recent", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status")
        .order("detection_time", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const detected = !!todayQ.data;
  const time = todayQ.data ? new Date(todayQ.data.detection_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Student
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Welcome, {nameQ.data ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your discipline status for today.</p>
      </header>

      {/* North Star */}
      <section className="card-surface overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <span className={["grid h-14 w-14 shrink-0 place-items-center rounded-2xl", detected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"].join(" ")}>
              {detected ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Today's entry
              </div>
              <div className="mt-1 font-display text-2xl font-semibold tracking-tight">
                {todayQ.isLoading ? "Checking…" : detected ? `Detected at ${time}` : "Not detected yet"}
              </div>
              {todayQ.data && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">ID Card:</span>
                  {todayQ.data.id_card_found ? (
                    <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600"><TriangleAlert className="h-3.5 w-3.5" /> Not visible</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {todayQ.data && <StatusBadge status={todayQ.data.status} />}
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="This week" value={weekQ.data ?? 0} icon={<Activity className="h-4 w-4" />} />
        <Kpi label="Missed IDs (30d)" value={flaggedQ.data ?? 0} icon={<TriangleAlert className="h-4 w-4" />} tone="amber" />
        <Kpi label="Unread alerts" value={unreadQ.data ?? 0} icon={<Bell className="h-4 w-4" />} />
        <Kpi label="Total entries" value={weekQ.data ?? 0} icon={<GraduationCap className="h-4 w-4" />} />
      </div>

      {/* Recent activity */}
      <section className="card-surface p-0">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">Recent entries</h2>
          <Link to="/student/history" className="text-xs font-medium text-primary hover:underline">View all →</Link>
        </header>
        {recentQ.isLoading ? (
          <RowsSkeleton />
        ) : (recentQ.data ?? []).length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No entries yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(recentQ.data ?? []).map((r) => {
              const d = new Date(r.detection_time);
              return (
                <li key={r.id} className="flex items-center gap-4 px-6 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="text-xs text-muted-foreground">{r.id_card_found ? "ID Verified" : "ID not visible"}</div>
                  </div>
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

function Kpi({ label, value, icon, tone = "default" }: { label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "amber" }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <span className={["grid h-8 w-8 place-items-center rounded-lg", tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-primary/10 text-primary"].join(" ")}>
          {icon}
        </span>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-64 shimmer rounded-md" />
      <div className="h-28 card-surface p-6"><div className="h-full shimmer rounded-md" /></div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 card-surface p-5"><div className="h-full shimmer rounded-md" /></div>)}
      </div>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {[...Array(4)].map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-6 py-4">
          <span className="h-9 w-9 shrink-0 rounded-full shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 shimmer rounded" />
            <div className="h-3 w-24 shimmer rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

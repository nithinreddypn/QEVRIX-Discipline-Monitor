import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Teacher — QEVRIX" },
      { name: "description", content: "Analytics for your branch." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherAnalyticsPage,
});

type Row = { detection_time: string; id_card_found: boolean; student_id: string | null };

function TeacherAnalyticsPage() {
  const { user } = useAuth();

  const branch = useQuery({
    queryKey: ["teacher-branch", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("branch_id, branches(name, code)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { branch_id: string | null; branches: { name: string; code: string } | null } | null;
    },
  });

  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return d;
  }, []);

  const q = useQuery({
    queryKey: ["teacher-analytics", branch.data?.branch_id],
    enabled: !!branch.data?.branch_id,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("detections")
        .select("detection_time, id_card_found, student_id")
        .eq("branch_id", branch.data!.branch_id!)
        .gte("detection_time", start.toISOString())
        .order("detection_time", { ascending: true });
      return (data as Row[] | null) ?? [];
    },
  });

  const rows = q.data ?? [];
  const totalWeek = rows.length;
  const withoutId = rows.filter((r) => !r.id_card_found).length;

  const trend = useMemo(() => {
    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        count: 0,
      });
    }
    for (const r of rows) {
      const idx = Math.floor((new Date(r.detection_time).getTime() - start.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 7) buckets[idx].count++;
    }
    return buckets;
  }, [rows, start]);

  const max = Math.max(1, ...trend.map((b) => b.count));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scoped to your branch{branch.data?.branches ? ` · ${branch.data.branches.name} (${branch.data.branches.code})` : ""}.
        </p>
      </header>

      {!branch.data?.branch_id ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">
          You have not been assigned a branch yet. Contact your administrator.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Detections this week" value={totalWeek} />
            <StatCard label="Students without ID this week" value={withoutId} tone="amber" />
          </div>

          <div className="card-surface p-6">
            <div className="flex items-end justify-between">
              <h3 className="text-sm font-semibold">Attendance trend · last 7 days</h3>
              <span className="text-[11px] text-muted-foreground">{totalWeek} total</span>
            </div>
            <div className="mt-5">
              <div className="flex h-48 items-end gap-2">
                {trend.map((b, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/80"
                        style={{ height: `${(b.count / max) * 100}%` }}
                        title={`${b.label}: ${b.count}`}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <div className="card-surface p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={[
          "mt-2 font-display text-3xl font-semibold",
          tone === "amber" ? "text-amber-600" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Admin — QEVRIX" },
      { name: "description", content: "Daily, weekly and monthly detection summaries." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Row = { detection_time: string; id_card_found: boolean; status: string | null; student_id: string | null };

type Range = "day" | "week" | "month";

function rangeStart(range: Range): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(d.getDate() - 29);
  return d;
}

function ReportsPage() {
  const [range, setRange] = useState<Range>("week");

  const rows = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: async (): Promise<Row[]> => {
      const start = rangeStart(range).toISOString();
      const { data } = await supabase
        .from("detections")
        .select("detection_time, id_card_found, status, student_id")
        .gte("detection_time", start)
        .order("detection_time", { ascending: true });
      return (data as Row[] | null) ?? [];
    },
  });

  const summary = useMemo(() => {
    const list = rows.data ?? [];
    const total = list.length;
    const withId = list.filter((r) => r.id_card_found).length;
    const withoutId = total - withId;
    const flagged = list.filter((r) => (r.status ?? "").toLowerCase() === "flagged").length;
    const unknown = list.filter((r) => !r.student_id).length;
    return { total, withId, withoutId, flagged, unknown };
  }, [rows.data]);

  const trend = useMemo(() => {
    const days = range === "day" ? 1 : range === "week" ? 7 : 30;
    const buckets: { label: string; count: number }[] = [];
    const start = rangeStart(range);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: 0,
      });
    }
    for (const r of rows.data ?? []) {
      const t = new Date(r.detection_time);
      const idx = Math.floor((t.getTime() - start.getTime()) / 86_400_000);
      if (idx >= 0 && idx < days) buckets[idx].count += 1;
    }
    return buckets;
  }, [rows.data, range]);

  const maxCount = Math.max(1, ...trend.map((b) => b.count));

  const cards = [
    { label: "Total detections", value: summary.total },
    { label: "ID present", value: summary.withId, tone: "green" as const },
    { label: "ID missing", value: summary.withoutId, tone: "amber" as const },
    { label: "Flagged", value: summary.flagged, tone: "amber" as const },
    { label: "Unknown persons", value: summary.unknown, tone: "amber" as const },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate counts and a lightweight trend view.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-white p-1">
          {(["day", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={[
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {r === "day" ? "Today" : r === "week" ? "Last 7 days" : "Last 30 days"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div
              className={[
                "mt-3 font-display text-3xl font-semibold tracking-tight tabular-nums",
                c.tone === "amber" ? "text-amber-700" : c.tone === "green" ? "text-primary" : "text-foreground",
              ].join(" ")}
            >
              {rows.isLoading ? "—" : c.value}
            </div>
          </div>
        ))}
      </div>

      <section className="card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Detections trend</h2>
          <span className="text-xs text-muted-foreground">Peak: {maxCount}</span>
        </div>
        {trend.length === 1 ? (
          <div className="text-3xl font-semibold tabular-nums">{trend[0].count} <span className="text-sm font-normal text-muted-foreground">detections today</span></div>
        ) : (
          <div className="flex h-48 items-end gap-2">
            {trend.map((b, i) => {
              const h = Math.round((b.count / maxCount) * 100);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full h-36 items-end">
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={`${b.count}`}
                    />
                  </div>
                  <div className="whitespace-nowrap text-[10px] text-muted-foreground">{b.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

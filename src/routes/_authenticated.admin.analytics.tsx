import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Admin — QEVRIX" },
      { name: "description", content: "Institution-wide detection analytics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalyticsPage,
});

type Row = {
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
  student_id: string | null;
  branch_id: string | null;
  color_match: boolean | null;
  branches: { code: string | null; name: string | null } | null;
};
type Range = 7 | 30 | 90;

function AdminAnalyticsPage() {
  const [days, setDays] = useState<Range>(30);

  const q = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: async (): Promise<Row[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));
      const { data } = await supabase
        .from("detections")
        .select("detection_time, id_card_found, status, student_id, branch_id, color_match, branches(code, name)")
        .gte("detection_time", start.toISOString())
        .order("detection_time", { ascending: true });
      return (data as unknown as Row[] | null) ?? [];
    },
  });

  const rows = q.data ?? [];

  const trend = useMemo(() => {
    const buckets: { label: string; count: number }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: 0,
      });
    }
    for (const r of rows) {
      const t = new Date(r.detection_time);
      const idx = Math.floor((t.getTime() - start.getTime()) / 86_400_000);
      if (idx >= 0 && idx < days) buckets[idx].count++;
    }
    return buckets;
  }, [rows, days]);

  const byBranch = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const r of rows) {
      const key = r.branches?.code ?? "—";
      const cur = map.get(key) ?? { label: key, count: 0 };
      cur.count++;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rows]);

  const idRatio = useMemo(() => {
    const found = rows.filter((r) => r.id_card_found).length;
    const total = rows.length || 1;
    return { found, missing: rows.length - found, total, pct: Math.round((found / total) * 100) };
  }, [rows]);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, count: 0, h }));
    for (const r of rows) buckets[new Date(r.detection_time).getHours()].count++;
    return buckets;
  }, [rows]);

  const mismatch = useMemo(() => {
    const withStudent = rows.filter((r) => r.student_id && r.id_card_found);
    const total = withStudent.length || 1;
    const mm = withStudent.filter((r) => r.color_match === false).length;
    return { mm, total: withStudent.length, pct: Math.round((mm / total) * 100) };
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trends and distributions across the entire institution.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-white p-1 text-[13px]">
          {([7, 30, 90] as Range[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={[
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </header>

      <ChartCard title="Detections over time" hint={`${rows.length} events · last ${days} days`}>
        <TrendBars data={trend} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Detections by branch">
          <BranchBars data={byBranch} />
        </ChartCard>
        <ChartCard title="ID found vs not found">
          <Donut found={idRatio.found} missing={idRatio.missing} pct={idRatio.pct} />
        </ChartCard>
        <ChartCard title="Busiest entry hours">
          <HourBars data={byHour} />
        </ChartCard>
        <ChartCard title="Branch color mismatch rate" hint="Among recognised students with an ID">
          <MismatchGauge pct={mismatch.pct} mm={mismatch.mm} total={mismatch.total} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-end justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function TrendBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-48 items-end gap-[3px]">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-primary/80 transition-colors hover:bg-primary"
          style={{ height: `${(d.count / max) * 100}%` }}
          title={`${d.label}: ${d.count}`}
        />
      ))}
    </div>
  );
}

function BranchBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0)
    return <div className="py-8 text-center text-sm text-muted-foreground">No data yet.</div>;
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{d.label}</span>
            <span className="text-muted-foreground">{d.count}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HourBars({ data }: { data: { label: string; count: number; h: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]">
        {data.map((d) => (
          <div
            key={d.h}
            className="flex-1 rounded-t-sm bg-primary/80"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${d.label}: ${d.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}

function Donut({ found, missing, pct }: { found: number; missing: number; pct: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-32 w-32">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#22C55E" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="66" textAnchor="middle" className="fill-foreground text-[18px] font-semibold">{pct}%</text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> ID present <span className="text-muted-foreground">· {found}</span></div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted" /> No ID <span className="text-muted-foreground">· {missing}</span></div>
      </div>
    </div>
  );
}

function MismatchGauge({ pct, mm, total }: { pct: number; mm: number; total: number }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold text-amber-600">{pct}%</span>
        <span className="text-sm text-muted-foreground">flagged</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {mm} of {total} recognised students had a branch-color mismatch.
      </p>
    </div>
  );
}

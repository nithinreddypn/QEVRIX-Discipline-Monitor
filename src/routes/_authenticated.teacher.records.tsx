import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

export const Route = createFileRoute("/_authenticated/teacher/records")({
  head: () => ({
    meta: [
      { title: "Detection Records — Teacher — QEVRIX" },
      { name: "description", content: "Detection records for your branch." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherRecordsPage,
});

type Row = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
  student_name: string | null;
  student_id: string | null;
  students: { usn: string | null } | null;
};

const STATUSES = ["all", "verified", "flagged", "pending", "unknown"] as const;

function useTypewriterPlaceholder(placeholders: string[], speed = 80, delay = 1500) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const full = placeholders[index];

    if (isDeleting) {
      timer = setTimeout(() => {
        setText(full.substring(0, text.length - 1));
      }, speed / 2);
    } else {
      timer = setTimeout(() => {
        setText(full.substring(0, text.length + 1));
      }, speed);
    }

    if (!isDeleting && text === full) {
      timer = setTimeout(() => setIsDeleting(true), delay);
    } else if (isDeleting && text === "") {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % placeholders.length);
    }

    return () => clearTimeout(timer);
  }, [text, isDeleting, index, placeholders, speed, delay]);

  return text;
}

function TeacherRecordsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const typewriterText = useTypewriterPlaceholder([
    "Search by student name...",
    "Search by USN (e.g. 1GA)...",
    "Filter by detection status..."
  ]);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const todayString = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const records = useQuery({
    queryKey: ["teacher-records", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      // Fetch teacher's branch_id
      const { data: teacher } = await supabase
        .from("teachers")
        .select("branch_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const branchId = teacher?.branch_id;

      if (!branchId) return [];

      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status, student_name, student_id, students(usn)")
        .eq("branch_id", branchId)
        .order("detection_time", { ascending: false })
        .limit(500);
      return (data as unknown as Row[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null;
    return (records.data ?? []).filter((r) => {
      const t = new Date(r.detection_time).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (status !== "all") {
        const s = (r.status ?? "unknown").toLowerCase();
        if (s !== status) return false;
      }
      if (term) {
        const hay = `${r.student_name ?? ""} ${r.students?.usn ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [records.data, q, status, from, to]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Detection Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All detections for your branch — filter by date, status, or student.
        </p>
      </header>

      <div className="card-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typewriterText}
              className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              const val = e.target.value;
              setFrom(val);
              if (to && to < val) {
                setTo(val);
              }
            }}
            max={todayString}
            className="rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from || undefined}
            max={todayString}
            className="rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-surface overflow-hidden p-0">
        {records.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">No records</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              No detections match the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">USN</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {filtered.map((r) => {
                  const d = new Date(r.detection_time);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: "/detections/$id", params: { id: r.id } })}
                      className="cursor-pointer transition-colors hover:bg-secondary/30"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-foreground">
                        {d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-foreground">
                        {r.student_name ?? "Unknown"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-muted-foreground">
                        {r.students?.usn ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <YesNoBadge yes={r.id_card_found} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

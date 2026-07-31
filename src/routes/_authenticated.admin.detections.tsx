import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/detections")({
  head: () => ({
    meta: [
      { title: "Detection History — Admin — QEVRIX" },
      { name: "description", content: "System-wide detection history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetectionsPage,
});

type Branch = { id: string; code: string; name: string };
type Row = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
  student_name: string | null;
  branch_id: string | null;
  branches: { code: string | null; name: string | null } | null;
  students: { usn: string | null } | null;
  is_repeat: boolean | null;
  repeat_count: number | null;
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

function DetectionsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const typewriterText = useTypewriterPlaceholder([
    "Search by student name...",
    "Search by USN (e.g. 1GA)...",
    "Filter by detection keyword..."
  ]);
  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [idFound, setIdFound] = useState<"all" | "yes" | "no">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const todayString = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const branches = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const rows = useQuery({
    queryKey: ["admin-detections"],
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status, student_name, branch_id, branches(code, name), students(usn), is_repeat, repeat_count")
        .order("detection_time", { ascending: false })
        .limit(2000);
      return (data as unknown as Row[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null;
    return (rows.data ?? []).filter((r) => {
      const t = new Date(r.detection_time).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (branchId !== "all" && r.branch_id !== branchId) return false;
      if (status !== "all" && (r.status ?? "unknown").toLowerCase() !== status) return false;
      if (idFound === "yes" && !r.id_card_found) return false;
      if (idFound === "no" && r.id_card_found) return false;
      if (term) {
        const hay = `${r.student_name ?? ""} ${r.students?.usn ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows.data, q, branchId, status, idFound, from, to]);

  function exportCsv() {
    const header = ["date", "time", "student", "usn", "branch", "id_found", "status"];
    const csv = [header.join(",")]
      .concat(
        filtered.map((r) => {
          const d = new Date(r.detection_time);
          return [
            d.toISOString().slice(0, 10),
            d.toTimeString().slice(0, 5),
            escapeCsv(r.student_name ?? "Unknown"),
            escapeCsv(r.students?.usn ?? ""),
            escapeCsv(r.branches?.code ?? ""),
            r.id_card_found ? "yes" : "no",
            escapeCsv(r.status ?? "unknown"),
          ].join(",");
        }),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Detection History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every detection captured across the institution.</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost text-sm">
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </button>
      </header>

      <div className="card-surface p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2 group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typewriterText}
              className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
            <option value="all">All branches</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.code}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className={selectCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={idFound} onChange={(e) => setIdFound(e.target.value as "all" | "yes" | "no")} className={selectCls}>
            <option value="all">ID: any</option>
            <option value="yes">ID: found</option>
            <option value="no">ID: missing</option>
          </select>
          <div className="flex gap-2">
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
              className={selectCls + " w-full"}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
              max={todayString}
              className={selectCls + " w-full"}
            />
          </div>
        </div>
      </div>

      <div className="card-surface overflow-hidden p-0">
        {rows.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">No detections</h3>
            <p className="mt-1 text-sm text-muted-foreground">Nothing matches the current filters.</p>
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
                  <th className="px-6 py-3">Branch</th>
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
                      className="cursor-pointer hover:bg-secondary/30"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-foreground">
                        {d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-foreground flex items-center gap-2">
                        <span>{r.student_name ?? "Unknown"}</span>
                        {r.is_repeat && (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                            Repeat ({r.repeat_count})
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-muted-foreground">{r.students?.usn ?? "—"}</td>
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
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {rows.data?.length ?? 0} records.</p>
    </div>
  );
}

const selectCls =
  "rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function escapeCsv(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

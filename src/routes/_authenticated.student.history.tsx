import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

export const Route = createFileRoute("/_authenticated/student/history")({
  head: () => ({
    meta: [
      { title: "Detection History — QEVRIX" },
      { name: "description", content: "Your detection history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
};

function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const q = useQuery({
    queryKey: ["student-history", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status")
        .order("detection_time", { ascending: false })
        .limit(500);
      return (data as Row[] | null) ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = [...(q.data ?? [])];
    list.sort((a, b) => {
      const av = new Date(a.detection_time).getTime();
      const bv = new Date(b.detection_time).getTime();
      return dir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [q.data, dir]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Detection History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of every time you've been detected on campus.
        </p>
      </header>

      <div className="card-surface overflow-hidden p-0">
        {q.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">
                    <button
                      onClick={() => setDir(dir === "desc" ? "asc" : "desc")}
                      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Date
                      {dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">ID Detected</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map((r) => {
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

function EmptyState() {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <ClipboardList className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">No detections yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Once you're detected on campus, your entries will appear here with time and verification status.
      </p>
    </div>
  );
}

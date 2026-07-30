import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, CheckCircle2, Trash2 } from "lucide-react";
import { classifyNotification, NotificationEmpty, NotificationItem } from "@/components/common/NotificationItem";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Teacher — QEVRIX" },
      { name: "description", content: "Branch notifications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherNotificationsPage,
});

type Notif = { id: string; type: string | null; message: string; is_read: boolean; created_at: string };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "no_id", label: "Without ID" },
  { key: "unknown", label: "Unknown Student" },
  { key: "late", label: "Late Entry" },
] as const;

function matchesFilter(n: Notif, key: (typeof FILTERS)[number]["key"]) {
  if (key === "all") return true;
  const hay = `${n.type ?? ""} ${n.message}`.toLowerCase();
  if (key === "no_id") return /no id|without id|id missing|id not/.test(hay);
  if (key === "unknown") return /unknown/.test(hay);
  if (key === "late") return /late/.test(hay);
  return true;
}

function TeacherNotificationsPage() {
  const qc = useQueryClient();
  const key = ["teacher-notifications"];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Notif[]> => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, message, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data as Notif[] | null) ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Deleted");
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const items = useMemo(() => (q.data ?? []).filter((n) => matchesFilter(n, filter)), [q.data, filter]);
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-card p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Notifications</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {unread > 0 ? (
                  <><span className="font-semibold text-primary">{unread}</span> unread · </>
                ) : (
                  "All caught up · "
                )}
                Alerts from detections in your branch.
              </p>
            </div>
          </div>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} className="btn-ghost text-sm">Mark all as read</button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                active
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-card text-muted-foreground ring-border hover:text-foreground",
              ].join(" ")}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="card-surface p-0">
        {q.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <NotificationEmpty sub="You'll see branch alerts here as they arrive." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const d = new Date(n.created_at);
              return (
                <NotificationItem
                  key={n.id}
                  tone={classifyNotification(n.type, n.message)}
                  isRead={n.is_read}
                  message={n.message}
                  meta={d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  actions={
                    <>
                      {!n.is_read && (
                        <button
                          onClick={() => markRead.mutate(n.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title="Mark read"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => del.mutate(n.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

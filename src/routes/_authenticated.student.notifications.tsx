import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { classifyNotification, NotificationEmpty, NotificationItem } from "@/components/common/NotificationItem";
import { Inbox, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — QEVRIX" },
      { name: "description", content: "Your notifications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

type Notif = { id: string; type: string; message: string; is_read: boolean; created_at: string };

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["student-notifications", user?.id];

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
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
      if (!user) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("recipient_user_id", user.id).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const items = q.data ?? [];
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
                  <>
                    <span className="font-semibold text-primary">{unread}</span> unread ·{" "}
                    <span>{items.length} total</span>
                  </>
                ) : (
                  "You're all caught up."
                )}
              </p>
            </div>
          </div>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} className="btn-ghost text-sm">Mark all as read</button>
          )}
        </div>
      </header>

      <div className="card-surface p-0">
        {q.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <NotificationEmpty sub="You'll get a note here when there's something to know." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                tone={classifyNotification(n.type, n.message)}
                isRead={n.is_read}
                message={n.message}
                meta={
                  <>
                    {new Date(n.created_at).toLocaleString()} ·{" "}
                    <span className="capitalize">{n.type.replace(/_/g, " ")}</span>
                  </>
                }
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

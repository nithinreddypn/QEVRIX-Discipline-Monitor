import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, UserRound, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/teachers/")({
  head: () => ({
    meta: [
      { title: "Teachers — Admin — QEVRIX" },
      { name: "description", content: "Manage teachers and branch assignments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeachersPage,
});

type Branch = { id: string; code: string; name: string };
type Teacher = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  branch_id: string | null;
  profile_photo_url: string | null;
  branches: { code: string | null; name: string | null } | null;
};

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

const emptyForm = { full_name: "", email: "", phone: "", branch_id: "" };

function TeachersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const typewriterText = useTypewriterPlaceholder([
    "Search by teacher name...",
    "Search by email address...",
    "Search by department (e.g. ISE)..."
  ]);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDel, setConfirmDel] = useState<Teacher | null>(null);

  const branches = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const teachers = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async (): Promise<Teacher[]> => {
      const { data } = await supabase
        .from("teachers")
        .select("id, full_name, email, phone, branch_id, profile_photo_url, branches(code, name)")
        .order("full_name");
      return (data as unknown as Teacher[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return teachers.data ?? [];
    return (teachers.data ?? []).filter(
      (t) =>
        t.full_name.toLowerCase().includes(term) ||
        (t.email ?? "").toLowerCase().includes(term) ||
        (t.branches?.code ?? "").toLowerCase().includes(term),
    );
  }, [teachers.data, q]);

  const upsert = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      const row = {
        full_name: payload.full_name,
        email: payload.email || null,
        phone: payload.phone || null,
        branch_id: payload.branch_id || null,
      };
      if (payload.id) {
        const { error } = await supabase.from("teachers").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teachers").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      setEditing(null);
      setCreating(false);
      toast.success("Teacher saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      setConfirmDel(null);
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function openCreate() {
    setForm({ ...emptyForm, branch_id: branches.data?.[0]?.id ?? "" });
    setCreating(true);
  }
  function openEdit(t: Teacher) {
    setForm({
      full_name: t.full_name,
      email: t.email ?? "",
      phone: t.phone ?? "",
      branch_id: t.branch_id ?? "",
    });
    setEditing(t);
  }

  const open = creating || !!editing;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Teachers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {teachers.data ? `${teachers.data.length} total` : "Loading…"} · assign each teacher to the branch they oversee.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add teacher
        </button>
      </header>

      <div className="card-surface p-4">
        <div className="relative max-w-md group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={typewriterText}
            className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="card-surface overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">Teacher</th>
              <th className="px-6 py-3">Branch</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-secondary/30">
                <td className="whitespace-nowrap px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <ProfilePhoto
                      src={t.profile_photo_url}
                      className="h-8 w-8"
                      iconSizeClassName="h-4 w-4"
                      type="teacher"
                    />
                    <span className="font-medium text-foreground">{t.full_name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{t.branches?.code ?? "—"}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{t.email ?? "—"}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{t.phone ?? "—"}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-right">
                  <Link
                    to={`/admin/teachers/${t.id}`}
                    className="mr-2 inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button onClick={() => openEdit(t)} className="mr-2 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDel(t)} className="rounded p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !teachers.isLoading && (
              <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-muted-foreground">No teachers.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit teacher" : "Add teacher"}</DialogTitle>
            <DialogDescription>Assign the branch they will monitor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Branch / Department *">
              <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className={inputCls}>
                <option value="">— select branch —</option>
                {(branches.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            Branch assignment determines which students and detection records this teacher can view. Changing it takes effect immediately.
          </p>
          <DialogFooter>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="btn-ghost text-sm">Cancel</button>
            <button
              disabled={upsert.isPending || !form.full_name || !form.branch_id}
              onClick={() => upsert.mutate(editing ? { ...form, id: editing.id } : form)}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete teacher?</DialogTitle>
            <DialogDescription>This removes {confirmDel?.full_name}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setConfirmDel(null)} className="btn-ghost text-sm">Cancel</button>
            <button
              disabled={del.isPending}
              onClick={() => confirmDel && del.mutate(confirmDel.id)}
              className="inline-flex h-9 items-center rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

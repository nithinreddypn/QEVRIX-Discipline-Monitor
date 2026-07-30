import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Upload, UserRound, Eye } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/students/")({
  head: () => ({
    meta: [
      { title: "Students — Admin — QEVRIX" },
      { name: "description", content: "Manage all students system-wide." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

type Branch = { id: string; code: string; name: string };
type Student = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
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

const emptyForm = {
  full_name: "",
  usn: "",
  semester: "" as string | number,
  email: "",
  phone: "",
  branch_id: "" as string,
};

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const typewriterText = useTypewriterPlaceholder([
    "Search by student name...",
    "Search by USN (e.g. 1GA)...",
    "Search by email address...",
  ]);
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDel, setConfirmDel] = useState<Student | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const branches = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const students = useQuery({
    queryKey: ["admin-students"],
    queryFn: async (): Promise<Student[]> => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, usn, semester, email, phone, branch_id, profile_photo_url, branches(code, name)")
        .order("full_name");
      return (data as unknown as Student[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (students.data ?? []).filter((s) => {
      if (branchFilter !== "all" && s.branch_id !== branchFilter) return false;
      if (!term) return true;
      return (
        s.full_name.toLowerCase().includes(term) ||
        s.usn.toLowerCase().includes(term) ||
        (s.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [students.data, q, branchFilter]);

  const upsert = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      const row = {
        full_name: payload.full_name,
        usn: payload.usn,
        semester: payload.semester === "" ? null : Number(payload.semester),
        email: payload.email || null,
        phone: payload.phone || null,
        branch_id: payload.branch_id || null,
      };
      if (payload.id) {
        const { error } = await supabase.from("students").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      setEditing(null);
      setCreating(false);
      toast.success("Student saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      setConfirmDel(null);
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV appears empty");
      const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const iName = idx("full_name");
      const iUsn = idx("usn");
      const iSem = idx("semester");
      const iEmail = idx("email");
      const iPhone = idx("phone");
      const iBranch = idx("branch_code");
      if (iName < 0 || iUsn < 0) throw new Error("Missing required columns: full_name, usn");
      const branchByCode = new Map((branches.data ?? []).map((b) => [b.code.toUpperCase(), b.id]));
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((s) => s.trim());
        const code = iBranch >= 0 ? cols[iBranch]?.toUpperCase() : undefined;
        return {
          full_name: cols[iName] ?? "",
          usn: cols[iUsn] ?? "",
          semester: iSem >= 0 && cols[iSem] ? Number(cols[iSem]) : null,
          email: iEmail >= 0 ? cols[iEmail] || null : null,
          phone: iPhone >= 0 ? cols[iPhone] || null : null,
          branch_id: code ? branchByCode.get(code) ?? null : null,
        };
      }).filter((r) => r.full_name && r.usn);
      if (rows.length === 0) throw new Error("No valid rows in CSV");
      const { error } = await supabase.from("students").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success(`Imported ${n} students`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  function openCreate() {
    setForm({ ...emptyForm, branch_id: branches.data?.[0]?.id ?? "" });
    setCreating(true);
  }
  function openEdit(s: Student) {
    setForm({
      full_name: s.full_name,
      usn: s.usn,
      semester: s.semester ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      branch_id: s.branch_id ?? "",
    });
    setEditing(s);
  }

  const open = creating || !!editing;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.data ? `${students.data.length} total` : "Loading…"} · manage all students across every branch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv.mutate(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost text-sm">
            <Upload className="mr-1.5 h-4 w-4" /> Import CSV
          </button>
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add student
          </button>
        </div>
      </header>

      <div className="card-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typewriterText}
              className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All branches</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-surface overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">USN</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Sem</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/30">
                  <td className="whitespace-nowrap px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <ProfilePhoto
                        src={s.profile_photo_url}
                        className="h-8 w-8"
                        iconSizeClassName="h-4 w-4"
                      />
                      <span className="font-medium text-foreground">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-muted-foreground">{s.usn}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{s.branches?.code ?? "—"}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{s.semester ?? "—"}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{s.email ?? s.phone ?? "—"}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-right">
                    <Link
                      to={`/admin/students/${s.id}`}
                      className="mr-2 inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button onClick={() => openEdit(s)} className="mr-2 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDel(s)} className="rounded p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !students.isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground">No students match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        CSV columns: <span className="font-mono">full_name, usn, semester, email, phone, branch_code</span>
      </p>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>Details managed by administrators.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} /></Field>
            <Field label="USN"><input value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value.toUpperCase() })} className={inputCls} /></Field>
            <Field label="Branch">
              <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className={inputCls}>
                <option value="">— none —</option>
                {(branches.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Semester"><input type="number" min={1} max={8} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
          </div>
          <DialogFooter>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="btn-ghost text-sm">Cancel</button>
            <button
              disabled={upsert.isPending || !form.full_name || !form.usn}
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
            <DialogTitle>Delete student?</DialogTitle>
            <DialogDescription>This removes {confirmDel?.full_name} and unlinks their detections.</DialogDescription>
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

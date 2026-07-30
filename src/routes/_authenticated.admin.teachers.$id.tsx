import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, UserRound, Pencil, Trash2, Building, Activity, CheckSquare, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/teachers/$id")({
  head: () => ({
    meta: [
      { title: "Teacher Detail — Admin — QEVRIX" },
      { name: "description", content: "Administrator view of teacher details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTeacherDetailPage,
});

type Teacher = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  branch_id: string | null;
  profile_photo_url: string | null;
  status: string;
  created_at: string;
  branches: { name: string; code: string } | null;
};

type AuditNotif = {
  id: string;
  created_at: string;
  message: string;
  type: string;
};

type StudentApproval = {
  id: string;
  full_name: string;
  usn: string;
  status: string;
  rejection_reason: string | null;
};

type Branch = {
  id: string;
  code: string;
  name: string;
};

function AdminTeacherDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    branch_id: "",
  });

  const branches = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const teacher = useQuery({
    queryKey: ["admin-teacher", id],
    queryFn: async (): Promise<Teacher | null> => {
      const { data } = await supabase
        .from("teachers")
        .select("id, user_id, full_name, email, phone, branch_id, profile_photo_url, status, created_at, branches(name, code)")
        .eq("id", id)
        .maybeSingle();
      return (data as unknown as Teacher | null) ?? null;
    },
  });

  // Query notifications logs containing this teacher's name
  const activities = useQuery({
    queryKey: ["admin-teacher-activities", teacher.data?.full_name],
    enabled: !!teacher.data?.full_name,
    queryFn: async (): Promise<AuditNotif[]> => {
      const name = teacher.data!.full_name;
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, message, type")
        .ilike("message", `%${name}%`)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as AuditNotif[] | null) ?? [];
    },
  });

  // Query students approved/rejected by this teacher based on decision log text
  const studentApprovals = useQuery({
    queryKey: ["admin-teacher-student-decisions", teacher.data?.full_name],
    enabled: !!teacher.data?.full_name,
    queryFn: async (): Promise<StudentApproval[]> => {
      const name = teacher.data!.full_name;
      const { data } = await supabase
        .from("students")
        .select("id, full_name, usn, status, rejection_reason")
        .ilike("rejection_reason", `%by ${name}%`)
        .order("full_name");
      return (data as StudentApproval[] | null) ?? [];
    },
  });

  const updateTeacher = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("teachers")
        .update({
          full_name: editForm.full_name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          branch_id: editForm.branch_id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teacher", id] });
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Teacher profile updated");
      setIsEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTeacher = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Teacher profile deleted");
      navigate({ to: "/admin/teachers" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const t = teacher.data;

  function openEdit() {
    if (!t) return;
    setEditForm({
      full_name: t.full_name,
      email: t.email ?? "",
      phone: t.phone ?? "",
      branch_id: t.branch_id ?? "",
    });
    setIsEditing(true);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/teachers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to teachers
      </Link>

      {teacher.isLoading ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">Loading teacher…</div>
      ) : !t ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">Teacher not found.</div>
      ) : (
        <>
          <section className="card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex flex-wrap items-center gap-5">
                <ProfilePhoto
                  src={t.profile_photo_url}
                  className="h-16 w-16"
                  iconSizeClassName="h-7 w-7"
                  type="teacher"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold tracking-tight">{t.full_name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {t.branches && (
                      <span className="inline-flex items-center gap-1">
                        <Building className="h-3.5 w-3.5" /> Oversees: {t.branches.name} ({t.branches.code})
                      </span>
                    )}
                    <span>Registered {new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openEdit} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit details
                </button>
                <button onClick={() => setConfirmDel(true)} className="btn-ghost text-xs border-rose-500/20 text-rose-500 hover:bg-rose-500/10 inline-flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Delete teacher
                </button>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={t.email ?? "—"} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={t.phone ?? "—"} />
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Activities audit section */}
            <section className="card-surface p-0 flex flex-col">
              <header className="border-b border-border px-6 py-4 flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-primary" />
                <h2 className="font-display text-base font-semibold tracking-tight">Recent activities & actions</h2>
              </header>
              <div className="flex-1 overflow-y-auto max-h-[450px]">
                {activities.isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading actions…</div>
                ) : activities.data?.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">No recorded activities for this teacher.</div>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {(activities.data ?? []).map((a) => (
                      <li key={a.id} className="p-4 hover:bg-secondary/20 transition-colors">
                        <p className="text-foreground font-medium leading-relaxed">{a.message}</p>
                        <time className="block mt-1 text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Students approved/rejected list */}
            <section className="card-surface p-0 flex flex-col">
              <header className="border-b border-border px-6 py-4 flex items-center gap-2">
                <CheckSquare className="h-4.5 w-4.5 text-primary" />
                <h2 className="font-display text-base font-semibold tracking-tight">Student registration decisions</h2>
              </header>
              <div className="flex-1 overflow-y-auto max-h-[450px]">
                {studentApprovals.isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading decisions…</div>
                ) : studentApprovals.data?.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">No student decisions recorded yet.</div>
                ) : (
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-secondary/40">
                      <tr className="text-left font-semibold uppercase text-muted-foreground tracking-wide">
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">USN</th>
                        <th className="px-5 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {(studentApprovals.data ?? []).map((s) => (
                        <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3 font-semibold text-foreground">{s.full_name}</td>
                          <td className="px-5 py-3 text-muted-foreground font-mono">{s.usn}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              s.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {s.status === "active" ? "Approved" : "Rejected"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Teacher Profile</DialogTitle>
                <DialogDescription>Modify teacher profile information and department assign.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
                <Field label="Branch">
                  <select
                    value={editForm.branch_id}
                    onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— none —</option>
                    {(branches.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </div>

              <DialogFooter className="mt-4">
                <button onClick={() => setIsEditing(false)} className="btn-ghost text-sm">Cancel</button>
                <button
                  disabled={updateTeacher.isPending || !editForm.full_name}
                  onClick={() => updateTeacher.mutate()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {updateTeacher.isPending ? "Saving…" : "Save changes"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600">
                  <ShieldAlert className="h-5 w-5" /> Delete Teacher
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to permanently delete teacher {t.full_name}? This action is irreversible.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <button onClick={() => setConfirmDel(false)} className="btn-ghost text-sm">Cancel</button>
                <button
                  disabled={deleteTeacher.isPending}
                  onClick={() => deleteTeacher.mutate()}
                  className="btn-primary text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                >
                  Delete permanently
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-white text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

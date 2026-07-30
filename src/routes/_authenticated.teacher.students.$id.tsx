import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, UserRound, Pencil, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { validatePhotoFile } from "@/lib/upload";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teacher/students/$id")({
  head: () => ({
    meta: [
      { title: "Student — Teacher — QEVRIX" },
      { name: "description", content: "Student detail view." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDetailPage,
});

type Student = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  branch_id: string | null;
};

type Detection = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
};

function StudentDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    usn: "",
    semester: "" as string | number,
    email: "",
    phone: "",
  });
  const [changeReason, setChangeReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File) {
    if (!s) return;
    const check = validatePhotoFile(file);
    if (!check.ok) return toast.error(check.reason);
    setUploading(true);
    const path = `${s.id}/profile.${check.ext}`;
    const up = await supabase.storage.from("student-photos").upload(path, file, { upsert: true, contentType: file.type });

    if (up.error) {
      setUploading(false);
      return toast.error(up.error.message);
    }
    const { error } = await supabase
      .from("students")
      .update({ profile_photo_url: path })
      .eq("id", s.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Student profile photo updated");
    qc.invalidateQueries({ queryKey: ["teacher-student", id] });
  }

  const student = useQuery({
    queryKey: ["teacher-student", id],
    queryFn: async (): Promise<Student | null> => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, usn, semester, email, phone, profile_photo_url, branch_id")
        .eq("id", id)
        .maybeSingle();
      return (data as Student | null) ?? null;
    },
  });

  const detections = useQuery({
    queryKey: ["teacher-student-detections", id],
    queryFn: async (): Promise<Detection[]> => {
      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status")
        .eq("student_id", id)
        .order("detection_time", { ascending: false })
        .limit(50);
      return (data as Detection[] | null) ?? [];
    },
  });

  const updateStudent = useMutation({
    mutationFn: async () => {
      if (!changeReason.trim()) throw new Error("A reason for edit is required.");

      // 1. Update the student record
      const { error: updateErr } = await supabase
        .from("students")
        .update({
          full_name: editForm.full_name,
          usn: editForm.usn,
          semester: editForm.semester === "" ? null : Number(editForm.semester),
          email: editForm.email || null,
          phone: editForm.phone || null,
        })
        .eq("id", id);

      if (updateErr) throw updateErr;

      // 2. Fetch the teacher's name for the audit log
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id || "")
        .single();
      const teacherName = profile?.full_name || "A teacher";

      // 3. Find admin user to notify
      const { data: admin } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      const recipient = admin?.user_id || user?.id || "";

      // 4. Create an audit log notification
      if (recipient) {
        await supabase.from("notifications").insert({
          recipient_user_id: recipient,
          type: "system_audit",
          message: `Teacher ${teacherName} edited student ${editForm.full_name} (${editForm.usn}) details. Reason: ${changeReason.trim()}`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-student", id] });
      toast.success("Student details updated successfully");
      setIsEditing(false);
      setChangeReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update student details");
    },
  });

  const s = student.data;

  function openEdit() {
    if (!s) return;
    setEditForm({
      full_name: s.full_name,
      usn: s.usn,
      semester: s.semester ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
    });
    setChangeReason("");
    setIsEditing(true);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/teacher/students"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>

      {student.isLoading ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !s ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">
          Student not found or outside your branch scope.
        </div>
      ) : (
        <>
          <section className="card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative">
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground ring-1 ring-border">
                    <ProfilePhoto
                      src={s.profile_photo_url}
                      className="h-16 w-16"
                      iconSizeClassName="h-7 w-7"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center text-[10px]">Uploading…</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition hover:opacity-90 disabled:opacity-60"
                    aria-label="Change student photo"
                    title="Change student photo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-semibold tracking-tight">{s.full_name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-mono text-xs">{s.usn}</span>
                    <span>Semester {s.semester ?? "—"}</span>
                  </div>
                </div>
              </div>
              <button onClick={openEdit} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={s.email ?? "—"} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={s.phone ?? "—"} />
            </dl>
          </section>

          <section className="card-surface p-0">
            <header className="border-b border-border px-6 py-4">
              <h2 className="font-display text-base font-semibold tracking-tight">Recent detection history</h2>
            </header>
            {detections.isLoading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (detections.data ?? []).length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No detections yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-secondary/40">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3">ID Detected</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {(detections.data ?? []).map((r) => {
                      const d = new Date(r.detection_time);
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-secondary/30">
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
          </section>

          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Student Details</DialogTitle>
                <DialogDescription>Modify student information. Changing details requires providing a valid reason.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
                <Field label="USN">
                  <input
                    value={editForm.usn}
                    onChange={(e) => setEditForm({ ...editForm, usn: e.target.value.toUpperCase() })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
                <Field label="Semester">
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
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
              
              <div className="mt-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason for Edit (Required)</label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Explain why these details are being updated..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <DialogFooter className="mt-4">
                <button onClick={() => setIsEditing(false)} className="btn-ghost text-sm">Cancel</button>
                <button
                  disabled={updateStudent.isPending || !editForm.full_name || !editForm.usn || !changeReason.trim()}
                  onClick={() => updateStudent.mutate()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {updateStudent.isPending ? "Saving…" : "Save changes"}
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

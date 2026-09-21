import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Calendar, ExternalLink, Eye, GraduationCap, Mail, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import { decideStudentApproval } from "@/lib/email";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Registration Approvals — Admin — QEVRIX" },
      { name: "description", content: "Review and approve system-wide registrations." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistrationApprovalsPage,
});

type PendingTeacher = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  status: string;
  rejection_reason?: string | null;
  profile_photo_url: string | null;
  branches: { name: string; code: string; color_hex: string } | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  status: string;
  rejection_reason?: string | null;
  profile_photo_url: string | null;
  branches: { name: string; code: string; color_hex: string } | null;
};

function RegistrationApprovalsPage() {
  const qc = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState<"teachers" | "students">("teachers");
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "approved" | "rejected">("pending");

  // Reject dialog states
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string; type: "teacher" | "student" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // View profile dialog state
  const [viewProfileTarget, setViewProfileTarget] = useState<
    | { type: "teacher"; data: PendingTeacher }
    | { type: "student"; data: StudentRow }
    | null
  >(null);

  const teachersQ = useQuery({
    queryKey: ["admin-teacher-approvals"],
    queryFn: async (): Promise<PendingTeacher[]> => {
      const { data } = await supabase
        .from("teachers")
        .select("id, user_id, full_name, email, phone, created_at, status, rejection_reason, profile_photo_url, branches(name, code, color_hex)")
        .order("created_at", { ascending: false });
      return (data as unknown as PendingTeacher[]) ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["admin-student-approvals"],
    queryFn: async (): Promise<StudentRow[]> => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, usn, semester, email, phone, created_at, status, rejection_reason, profile_photo_url, branches(name, code, color_hex)")
        .order("created_at", { ascending: false });
      return (data as unknown as StudentRow[]) ?? [];
    },
  });

  const decideTeacher = useMutation({
    mutationFn: async ({ id, approve, why }: { id: string; approve: boolean; why?: string }) => {
      const payload = approve
        ? { status: "active", rejection_reason: null }
        : { status: "rejected", rejection_reason: why || null };
      const { error } = await supabase.from("teachers").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "Teacher approved" : "Teacher rejected");
      qc.invalidateQueries({ queryKey: ["admin-teacher-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-approvals-count"] });
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      setRejectTarget(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decideStudent = useMutation({
    mutationFn: async ({ id, approve, why }: { id: string; approve: boolean; why?: string }) => {
      await decideStudentApproval({
        data: {
          studentId: id,
          status: approve ? "active" : "rejected",
          rejectionReason: why,
          decidedBy: "Administrator",
        }
      });
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "Student approved" : "Student signup rejected");
      qc.invalidateQueries({ queryKey: ["admin-student-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      setRejectTarget(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const teachersList = teachersQ.data ?? [];
  const studentsList = studentsQ.data ?? [];

  const filteredTeachers = teachersList.filter((t) => {
    if (activeSubTab === "pending") return t.status === "pending_approval";
    if (activeSubTab === "approved") return t.status === "active";
    if (activeSubTab === "rejected") return t.status === "rejected";
    return false;
  });

  const filteredStudents = studentsList.filter((s) => {
    if (activeSubTab === "pending") return s.status === "pending_approval";
    if (activeSubTab === "approved") return s.status === "active";
    if (activeSubTab === "rejected") return s.status === "rejected";
    return false;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Approvals Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage teacher registrations and review student approvals across all branches.
        </p>
      </header>

      {/* Main Tabs */}
      <div className="flex gap-4 border-b border-border pb-1">
        <button
          onClick={() => { setActiveMainTab("teachers"); setActiveSubTab("pending"); }}
          className={[
            "pb-3 text-sm font-medium transition-all relative",
            activeMainTab === "teachers"
              ? "text-primary border-b-2 border-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          ].join(" ")}
        >
          Teacher Registrations
          {teachersList.filter(t => t.status === "pending_approval").length > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {teachersList.filter(t => t.status === "pending_approval").length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveMainTab("students"); setActiveSubTab("pending"); }}
          className={[
            "pb-3 text-sm font-medium transition-all relative",
            activeMainTab === "students"
              ? "text-primary border-b-2 border-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          ].join(" ")}
        >
          Student Approvals
          {studentsList.filter(s => s.status === "pending_approval").length > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {studentsList.filter(s => s.status === "pending_approval").length}
            </span>
          )}
        </button>
      </div>

      {/* Sub Status Tabs */}
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((tab) => {
          const listToCount = activeMainTab === "teachers" ? teachersList : studentsList;
          const count = listToCount.filter((x) => {
            if (tab === "pending") return x.status === "pending_approval";
            if (tab === "approved") return x.status === "active";
            if (tab === "rejected") return x.status === "rejected";
            return false;
          }).length;

          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={[
                "px-3.5 py-1.5 text-xs font-medium rounded-full capitalize transition-all",
                activeSubTab === tab
                  ? "bg-secondary text-foreground font-semibold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              ].join(" ")}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {activeMainTab === "teachers" ? (
        teachersQ.isLoading ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">Loading teachers…</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">
            No teachers in this category.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTeachers.map((t) => (
              <article key={t.id} className="card-surface p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <button
                    type="button"
                    onClick={() => setViewProfileTarget({ type: "teacher", data: t })}
                    className="transition-transform hover:scale-105"
                    title="Click to view profile"
                  >
                    <ProfilePhoto
                      src={t.profile_photo_url}
                      className="h-12 w-12 cursor-pointer"
                      iconSizeClassName="h-6 w-6"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewProfileTarget({ type: "teacher", data: t })}
                        className="font-display text-base font-semibold tracking-tight hover:text-primary transition-colors text-left"
                      >
                        {t.full_name}
                      </button>
                      {t.status === "pending_approval" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>}
                      {t.status === "active" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Approved</span>}
                      {t.status === "rejected" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Rejected</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {t.email}</span>}
                      {t.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>}
                      {t.branches && (
                        <span className="inline-flex items-center gap-1" style={{ color: t.branches.color_hex }}>
                          <Building2 className="h-3 w-3" /> {t.branches.name} ({t.branches.code})
                        </span>
                      )}
                      <span>Requested {new Date(t.created_at).toLocaleString()}</span>
                    </div>
                    {t.status === "rejected" && t.rejection_reason && (
                      <div className="mt-2 text-xs text-destructive bg-destructive/5 p-2 rounded border border-destructive/10 max-w-xl">
                        <strong>Reason:</strong> {t.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewProfileTarget({ type: "teacher", data: t })}
                      className="btn-ghost px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 border border-border"
                      title="View Profile Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Profile
                    </button>
                    {t.status === "pending_approval" && (
                      <>
                        <button
                          onClick={() => setRejectTarget({ id: t.id, name: t.full_name, type: "teacher" })}
                          className="btn-ghost px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => decideTeacher.mutate({ id: t.id, approve: true })}
                          disabled={decideTeacher.isPending}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {t.status === "active" && (
                      <button
                        onClick={() => setRejectTarget({ id: t.id, name: t.full_name, type: "teacher" })}
                        className="btn-ghost text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-3 py-1.5"
                      >
                        Revoke & Reject
                      </button>
                    )}
                    {t.status === "rejected" && (
                      <button
                        onClick={() => decideTeacher.mutate({ id: t.id, approve: true })}
                        disabled={decideTeacher.isPending}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Approve Teacher
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        studentsQ.isLoading ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">Loading students…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">
            No students in this category.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredStudents.map((s) => (
              <article key={s.id} className="card-surface p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <button
                    type="button"
                    onClick={() => setViewProfileTarget({ type: "student", data: s })}
                    className="transition-transform hover:scale-105"
                    title="Click to view profile"
                  >
                    <ProfilePhoto
                      src={s.profile_photo_url}
                      className="h-12 w-12 cursor-pointer"
                      iconSizeClassName="h-6 w-6"
                      fallbackIcon={GraduationCap}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewProfileTarget({ type: "student", data: s })}
                        className="font-display text-base font-semibold tracking-tight hover:text-primary transition-colors text-left"
                      >
                        {s.full_name}
                      </button>
                      {s.status === "pending_approval" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>}
                      {s.status === "active" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Approved</span>}
                      {s.status === "rejected" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Rejected</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono text-xs">USN: {s.usn}</span>
                      {s.semester && <span>Semester {s.semester}</span>}
                      {s.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>}
                      {s.branches && (
                        <span className="inline-flex items-center gap-1" style={{ color: s.branches.color_hex }}>
                          <Building2 className="h-3 w-3" /> {s.branches.name} ({s.branches.code})
                        </span>
                      )}
                    </div>
                    {s.status !== "pending_approval" && s.rejection_reason && (
                      <div className={[
                        "mt-2 text-xs p-2 rounded border max-w-xl",
                        s.status === "active"
                          ? "text-emerald-700 bg-emerald-500/5 border-emerald-500/10"
                          : "text-rose-700 bg-rose-500/5 border-rose-500/10"
                      ].join(" ")}>
                        <strong>Decision Log:</strong> {s.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewProfileTarget({ type: "student", data: s })}
                      className="btn-ghost px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 border border-border"
                      title="View Profile Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Profile
                    </button>
                    {s.status === "pending_approval" && (
                      <>
                        <button
                          onClick={() => setRejectTarget({ id: s.id, name: s.full_name, type: "student" })}
                          className="btn-ghost px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => decideStudent.mutate({ id: s.id, approve: true })}
                          disabled={decideStudent.isPending}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {s.status === "active" && (
                      <button
                        onClick={() => setRejectTarget({ id: s.id, name: s.full_name, type: "student" })}
                        className="btn-ghost text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-3 py-1.5"
                      >
                        Revoke & Reject
                      </button>
                    )}
                    {s.status === "rejected" && (
                      <button
                        onClick={() => decideStudent.mutate({ id: s.id, approve: true })}
                        disabled={decideStudent.isPending}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Approve Student
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectionReason(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject {rejectTarget.name}?</DialogTitle>
              <DialogDescription>
                Optionally share a reason. It will be recorded in the system audit logs.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <DialogFooter className="mt-4">
              <button onClick={() => { setRejectTarget(null); setRejectionReason(""); }} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={() => {
                  if (rejectTarget.type === "teacher") {
                    decideTeacher.mutate({ id: rejectTarget.id, approve: false, why: rejectionReason });
                  } else {
                    decideStudent.mutate({ id: rejectTarget.id, approve: false, why: rejectionReason });
                  }
                }}
                disabled={decideTeacher.isPending || decideStudent.isPending}
                className="btn-primary text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                Reject {rejectTarget.type}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Profile Dialog */}
      {viewProfileTarget && (
        <Dialog open={!!viewProfileTarget} onOpenChange={(o) => { if (!o) setViewProfileTarget(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>
                  {viewProfileTarget.type === "teacher" ? "Teacher Profile" : "Student Profile"}
                </DialogTitle>
                {viewProfileTarget.data.status === "pending_approval" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>
                )}
                {viewProfileTarget.data.status === "active" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Approved</span>
                )}
                {viewProfileTarget.data.status === "rejected" && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Rejected</span>
                )}
              </div>
              <DialogDescription>
                Candidate details submitted during account registration.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 space-y-4">
              {/* Header card with photo and name */}
              <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <ProfilePhoto
                  src={viewProfileTarget.data.profile_photo_url}
                  className="h-16 w-16 rounded-xl border border-border"
                  iconSizeClassName="h-8 w-8"
                  fallbackIcon={viewProfileTarget.type === "student" ? GraduationCap : UserRound}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground truncate">
                    {viewProfileTarget.data.full_name}
                  </h3>
                  {viewProfileTarget.type === "student" && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      USN: <span className="font-mono font-medium text-foreground">{(viewProfileTarget.data as StudentRow).usn}</span>
                      {(viewProfileTarget.data as StudentRow).semester ? ` · Semester ${(viewProfileTarget.data as StudentRow).semester}` : ""}
                    </div>
                  )}
                  {viewProfileTarget.data.branches && (
                    <div
                      className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: viewProfileTarget.data.branches.color_hex }}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {viewProfileTarget.data.branches.name} ({viewProfileTarget.data.branches.code})
                    </div>
                  )}
                </div>
              </div>

              {/* Contact and Metadata Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg border border-border/70 p-2.5 bg-card">
                  <span className="text-muted-foreground block text-[11px]">Email Address</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{viewProfileTarget.data.email || "Not provided"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 p-2.5 bg-card">
                  <span className="text-muted-foreground block text-[11px]">Phone Number</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{viewProfileTarget.data.phone || "Not provided"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 p-2.5 bg-card">
                  <span className="text-muted-foreground block text-[11px]">Department / Branch</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground truncate">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {viewProfileTarget.data.branches ? `${viewProfileTarget.data.branches.code} - ${viewProfileTarget.data.branches.name}` : "Not assigned"}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 p-2.5 bg-card">
                  <span className="text-muted-foreground block text-[11px]">Registration Date</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{new Date(viewProfileTarget.data.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Decision Note or Rejection Reason if present */}
              {viewProfileTarget.data.rejection_reason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <strong className="block mb-0.5">Decision Note / Rejection Reason:</strong>
                  {viewProfileTarget.data.rejection_reason}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 flex flex-wrap sm:justify-between items-center gap-2">
              <Link
                to={viewProfileTarget.type === "teacher" ? "/admin/teachers/$id" : "/admin/students/$id"}
                params={{ id: viewProfileTarget.data.id }}
                className="btn-ghost text-xs inline-flex items-center gap-1.5 border border-border"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Full Profile Page
              </Link>
              <div className="flex gap-2">
                {viewProfileTarget.data.status === "pending_approval" && (
                  <>
                    <button
                      onClick={() => {
                        const target = { id: viewProfileTarget.data.id, name: viewProfileTarget.data.full_name, type: viewProfileTarget.type };
                        setViewProfileTarget(null);
                        setRejectTarget(target);
                      }}
                      className="btn-ghost text-xs text-destructive hover:bg-destructive/10"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        if (viewProfileTarget.type === "teacher") {
                          decideTeacher.mutate({ id: viewProfileTarget.data.id, approve: true });
                        } else {
                          decideStudent.mutate({ id: viewProfileTarget.data.id, approve: true });
                        }
                        setViewProfileTarget(null);
                      }}
                      className="btn-primary text-xs"
                    >
                      Approve
                    </button>
                  </>
                )}
                <button onClick={() => setViewProfileTarget(null)} className="btn-ghost text-xs">
                  Close
                </button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

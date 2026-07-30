import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Phone, UserRound } from "lucide-react";
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
                  <ProfilePhoto
                    src={t.profile_photo_url}
                    className="h-12 w-12"
                    iconSizeClassName="h-6 w-6"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold tracking-tight">{t.full_name}</h2>
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
                  <div className="flex gap-2">
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
                  <ProfilePhoto
                    src={s.profile_photo_url}
                    className="h-12 w-12"
                    iconSizeClassName="h-6 w-6"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold tracking-tight">{s.full_name}</h2>
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
                  <div className="flex gap-2">
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
    </div>
  );
}

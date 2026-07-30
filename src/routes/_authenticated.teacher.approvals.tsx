import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GraduationCap, Mail, Phone, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { decideStudentApproval, fetchPendingStudents } from "@/lib/email";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teacher/approvals")({
  head: () => ({
    meta: [
      { title: "Pending Approvals — QEVRIX" },
      { name: "description", content: "Review and approve new student signups." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

type PendingStudent = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  created_at: string;
  status: string;
  rejection_reason?: string | null;
  branch_id: string | null;
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rejectTarget, setRejectTarget] = useState<PendingStudent | null>(null);
  const [reason, setReason] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");

  const teacherProfile = useQuery({
    queryKey: ["current-teacher-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("full_name, branch_id")
        .eq("user_id", user?.id || "")
        .maybeSingle();
      return data;
    }
  });

  const teacherName = teacherProfile.data?.full_name || "Teacher";

  const q = useQuery({
    queryKey: ["teacher-approvals"],
    queryFn: async (): Promise<PendingStudent[]> => {
      // Use server function with service role to bypass RLS
      const data = await fetchPendingStudents();
      return (data as PendingStudent[]) ?? [];
    },
  });

  const decide = useMutation({
    motionFn: undefined,
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: "active" | "rejected"; rejection_reason?: string }) => {
      await decideStudentApproval({
        data: {
          studentId: id,
          status,
          rejectionReason: rejection_reason,
          decidedBy: teacherName,
        }
      });
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "active" ? "Student approved" : "Signup rejected");
      qc.invalidateQueries({ queryKey: ["teacher-approvals"] });
      qc.invalidateQueries({ queryKey: ["teacher-pending-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = q.data ?? [];

  // Filter students based on teacher's department branch
  const branchStudents = list.filter((s) => {
    if (teacherProfile.data?.branch_id) {
      return s.branch_id === teacherProfile.data.branch_id;
    }
    return true;
  });

  const filteredList = branchStudents.filter((s) => {
    if (activeTab === "pending") return s.status === "pending_approval";
    if (activeTab === "approved") return s.status === "active";
    if (activeTab === "rejected") return s.status === "rejected";
    return false;
  });

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5 text-primary" /> Teacher · Student approvals
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Student registrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review new student signups, view approved accounts, or manage rejected profiles.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        {(["pending", "approved", "rejected"] as const).map((tab) => {
          const count = branchStudents.filter((s) => {
            if (tab === "pending") return s.status === "pending_approval";
            if (tab === "approved") return s.status === "active";
            if (tab === "rejected") return s.status === "rejected";
            return false;
          }).length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all relative",
                activeTab === tab
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              ].join(" ")}
            >
              {tab} signups
              {count > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none rounded-full bg-foreground/10 text-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filteredList.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Check className="h-5 w-5" />
          </div>
          <div className="mt-4 font-display text-lg font-semibold">No students found</div>
          <p className="mt-1 text-sm text-muted-foreground">
            No students are currently in this list.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filteredList.map((s) => (
            <li key={s.id} className="card-surface p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-4">
                  <ProfilePhoto
                    src={s.profile_photo_url}
                    className="h-16 w-16 rounded-xl"
                    iconSizeClassName="h-6 w-6"
                    fallbackIcon={GraduationCap}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="truncate font-display text-base font-semibold tracking-tight">
                        {s.full_name}
                      </div>
                      {s.status === "pending_approval" && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                          Pending
                        </span>
                      )}
                      {s.status === "active" && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                          Approved
                        </span>
                      )}
                      {s.status === "rejected" && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      USN <span className="font-mono text-foreground">{s.usn}</span>
                      {s.semester ? <> · Sem {s.semester}</> : null}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{s.email}</div>}
                      {s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</div>}
                    </div>
                  </div>
                </div>

                {s.status === "rejected" && s.rejection_reason && (
                  <div className="mt-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive p-2.5 rounded-lg">
                    <strong>Reason for Rejection:</strong> {s.rejection_reason}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                {s.status === "pending_approval" && (
                  <>
                    <button
                      onClick={() => decide.mutate({ id: s.id, status: "active" })}
                      disabled={decide.isPending}
                      className="btn-primary flex-1 text-xs"
                    >
                      <Check className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectTarget(s); setReason(""); }}
                      disabled={decide.isPending}
                      className="btn-ghost flex-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} /> Reject
                    </button>
                  </>
                )}
                {s.status === "active" && (
                  <button
                    onClick={() => { setRejectTarget(s); setReason(""); }}
                    disabled={decide.isPending}
                    className="btn-ghost flex-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} /> Revoke & Reject
                  </button>
                )}
                {s.status === "rejected" && (
                  <button
                    onClick={() => decide.mutate({ id: s.id, status: "active" })}
                    disabled={decide.isPending}
                    className="btn-primary flex-1 text-xs"
                  >
                    <Check className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} /> Approve Student
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject signup</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Optionally leave a short reason. The student will be notified.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <DialogFooter>
            <button className="btn-ghost text-sm" onClick={() => setRejectTarget(null)}>Cancel</button>
            <button
              className="btn-primary text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
              onClick={() => {
                if (!rejectTarget) return;
                decide.mutate({ id: rejectTarget.id, status: "rejected", rejection_reason: reason.trim() || undefined });
                setRejectTarget(null);
              }}
            >
              Confirm reject
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

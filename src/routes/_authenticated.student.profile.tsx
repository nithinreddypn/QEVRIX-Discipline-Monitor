import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Mail, Pencil, Phone, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoUrl } from "@/lib/photo";

export const Route = createFileRoute("/_authenticated/student/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — QEVRIX" },
      { name: "description", content: "Your student profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentProfile,
});

type StudentRow = {
  id: string;
  usn: string | null;
  full_name: string | null;
  semester: number | null;
  profile_photo_url: string | null;
  email: string | null;
  phone: string | null;
  branch: { name: string | null; code: string | null } | null;
};

function StudentProfile() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["student-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StudentRow | null> => {
      const { data: s } = await supabase
        .from("students")
        .select("id, usn, full_name, semester, profile_photo_url, email, phone, branch:branches(name, code)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (s) return s as unknown as StudentRow;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user!.id)
        .maybeSingle();
      return {
        id: user!.id,
        usn: null,
        full_name: p?.full_name ?? null,
        semester: null,
        profile_photo_url: null,
        email: p?.email ?? user!.email ?? null,
        phone: p?.phone ?? null,
        branch: null,
      };
    },
  });

  const s = q.data;
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (s) {
      setFullName(s.full_name ?? "");
      setPhone(s.phone ?? "");
    }
  }, [s]);

  const signed = usePhotoUrl(s?.profile_photo_url ?? null);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error: pe } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);
    if (pe) {
      setSaving(false);
      return toast.error(pe.message);
    }
    await supabase.from("students").update({ full_name: fullName, phone }).eq("user_id", user.id);
    setSaving(false);
    setEditing(false);
    toast.success("Profile updated");
    q.refetch();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your student record. USN, branch, semester and email are managed by the institution.
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost inline-flex items-center gap-1.5 text-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </header>

      <div className="card-surface p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground ring-1 ring-border">
              {signed.data ? (
                <img src={signed.data} alt={s?.full_name ?? "Profile"} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10" strokeWidth={1.5} />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-semibold tracking-tight">
              {s?.full_name ?? "—"}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {s?.usn && <span>USN <span className="font-medium text-foreground">{s.usn}</span></span>}
              {s?.branch?.name && <span>· {s.branch.name}</span>}
              {s?.semester != null && <span>· Semester {s.semester}</span>}
            </div>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {editing ? (
            <EditRow label="Full name" value={fullName} onChange={setFullName} />
          ) : (
            <Row label="Full name" value={s?.full_name ?? "—"} />
          )}
          <Row label="USN" value={s?.usn ?? "Not assigned"} managed />
          <Row label="Branch" value={s?.branch?.name ?? "Not assigned"} managed />
          <Row label="Semester" value={s?.semester != null ? `Semester ${s.semester}` : "—"} managed />
          <Row
            label="Email"
            value={s?.email ?? "—"}
            icon={<Mail className="h-3.5 w-3.5" />}
            managed
            lockNote="Login identity"
          />
          {editing ? (
            <EditRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={phone} onChange={setPhone} type="tel" />
          ) : (
            <Row label="Phone" value={s?.phone ?? "—"} icon={<Phone className="h-3.5 w-3.5" />} />
          )}
        </dl>

        {editing && (
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-5">
            <button
              onClick={() => {
                setEditing(false);
                setFullName(s?.full_name ?? "");
                setPhone(s?.phone ?? "");
              }}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
  managed,
  lockNote,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  managed?: boolean;
  lockNote?: string;
}) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
        {managed && (
          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
            <Lock className="h-2.5 w-2.5" /> {lockNote ?? "Managed by admin"}
          </span>
        )}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function EditRow({
  label,
  value,
  onChange,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

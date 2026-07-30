import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Camera, Lock, Mail, Pencil, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePhotoUrl } from "@/lib/photo";
import { validatePhotoFile } from "@/lib/upload";


export const Route = createFileRoute("/_authenticated/teacher/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Teacher — QEVRIX" },
      { name: "description", content: "Your teacher profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherProfilePage,
});

type Teacher = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  branch_id: string | null;
  status: string | null;
  profile_photo_url: string | null;
  branches: { name: string; code: string; color_name: string; color_hex: string } | null;
};

function TeacherProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["teacher-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Teacher | null> => {
      const { data } = await supabase
        .from("teachers")
        .select("id, full_name, email, phone, branch_id, status, profile_photo_url, branches(name, code, color_name, color_hex)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as unknown as Teacher | null) ?? null;
    },
  });

  const t = q.data;
  const signed = usePhotoUrl(t?.profile_photo_url ?? null, "teacher");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing && t) {
      setFullName(t.full_name ?? "");
      setPhone(t.phone ?? "");
    }
  }, [t, editing]);

  async function uploadPhoto(file: File) {
    if (!user) return;
    const check = validatePhotoFile(file);
    if (!check.ok) return toast.error(check.reason);
    setUploading(true);
    const path = `${user.id}/profile.${check.ext}`;
    const up = await supabase.storage.from("teacher-photos").upload(path, file, { upsert: true, contentType: file.type });

    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("teachers").update({ profile_photo_url: path }).eq("user_id", user.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile photo updated");
    qc.invalidateQueries({ queryKey: ["teacher-profile", user.id] });
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from("teachers").update({ full_name: fullName, phone }).eq("user_id", user.id),
      supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      toast.error(r1.error?.message ?? r2.error?.message ?? "Failed to save");
      return;
    }
    toast.success("Profile updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["teacher-profile", user.id] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your teacher details. Branch and email are managed by administrators.
          </p>
        </div>
        {t && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost inline-flex items-center gap-1.5 text-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </header>

      {q.isLoading ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !t ? (
        <div className="card-surface p-12 text-center text-sm text-muted-foreground">
          No teacher record linked to this account yet.
        </div>
      ) : (
        <section className="card-surface p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground ring-1 ring-border">
                {signed.data ? (
                  <img src={signed.data} alt={t.full_name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-10 w-10" strokeWidth={1.5} />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition hover:opacity-90 disabled:opacity-60"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-display text-xl font-semibold tracking-tight">{t.full_name}</div>
                {t.status && t.status !== "active" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {t.status === "pending_approval" ? "Pending approval" : t.status}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {t.branches ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                    style={{
                      backgroundColor: `${t.branches.color_hex}14`,
                      color: t.branches.color_hex,
                      // @ts-expect-error inline
                      "--tw-ring-color": `${t.branches.color_hex}33`,
                    }}
                  >
                    <Building2 className="h-3 w-3" /> {t.branches.name} ({t.branches.code})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
                    <Building2 className="h-3 w-3" /> No branch assigned
                  </span>
                )}
              </div>
              {uploading && <div className="mt-2 text-xs text-muted-foreground">Uploading photo…</div>}
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {editing ? (
              <EditRow label="Full name" value={fullName} onChange={setFullName} />
            ) : (
              <Row label="Full name" value={t.full_name} />
            )}
            <Row label="Branch" value={t.branches?.name ?? "Not assigned"} managed />
            <Row label="Email" value={t.email ?? user?.email ?? "—"} icon={<Mail className="h-3.5 w-3.5" />} managed lockNote="Login identity" />
            {editing ? (
              <EditRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={phone} onChange={setPhone} type="tel" />
            ) : (
              <Row label="Phone" value={t.phone ?? "—"} icon={<Phone className="h-3.5 w-3.5" />} />
            )}
          </dl>

          {editing && (
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-5">
              <button
                onClick={() => {
                  setEditing(false);
                  setFullName(t.full_name ?? "");
                  setPhone(t.phone ?? "");
                }}
                className="btn-ghost text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Row({
  label, value, icon, managed, lockNote,
}: { label: string; value: string; icon?: React.ReactNode; managed?: boolean; lockNote?: string }) {
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
  label, value, onChange, icon, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode; type?: string }) {
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

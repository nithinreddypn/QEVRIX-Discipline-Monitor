import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Lock, Mail, Phone, Settings as SettingsIcon, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BackToDashboard } from "@/components/common/BackToDashboard";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — QEVRIX" },
      { name: "description", content: "Your QEVRIX profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};
type StudentRow = {
  usn: string | null;
  semester: number | null;
  profile_photo_url: string | null;
  branches: { name: string | null; code: string | null } | null;
};
type TeacherRow = {
  branches: { name: string | null; code: string | null } | null;
};

function ProfilePage() {
  const { user, roles } = useAuth();
  const role = roles[0] ?? "student";

  const q = useQuery({
    queryKey: ["identity", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, student, teacher] = await Promise.all([
        supabase.from("profiles").select("full_name, email, phone").eq("id", user!.id).maybeSingle(),
        role === "student"
          ? supabase
              .from("students")
              .select("usn, semester, profile_photo_url, branches(name, code)")
              .eq("user_id", user!.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
        role === "teacher"
          ? supabase
              .from("teachers")
              .select("branches(name, code)")
              .eq("user_id", user!.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);
      return {
        profile: (profile as ProfileRow | null) ?? null,
        student: (student.data as unknown as StudentRow | null) ?? null,
        teacher: (teacher.data as unknown as TeacherRow | null) ?? null,
      };
    },
  });

  const data = q.data;
  const displayName = data?.profile?.full_name ?? user?.email?.split("@")[0] ?? "—";
  const email = data?.profile?.email ?? user?.email ?? "—";
  const phone = data?.profile?.phone ?? "—";
  const photo = data?.student?.profile_photo_url ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <BackToDashboard />
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <SettingsIcon className="h-3.5 w-3.5" /> Edit in Settings
        </Link>
      </div>

      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your identity on file with the institution. Fields marked{" "}
          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Lock className="h-2.5 w-2.5" /> Managed by admin
          </span>{" "}
          can only be changed by an administrator.
        </p>
      </header>

      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground ring-1 ring-border">
            {photo ? (
              <img src={photo} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-9 w-9" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-semibold tracking-tight">{displayName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex rounded-full bg-accent px-2 py-0.5 font-medium capitalize text-accent-foreground">
                {role}
              </span>
              {role === "student" && data?.student?.branches && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {data.student.branches.name}
                  {data.student.semester != null && <> · Sem {data.student.semester}</>}
                </span>
              )}
              {role === "teacher" && data?.teacher?.branches && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {data.teacher.branches.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Row label="Full name" value={displayName} managed />
          <Row label="Email" value={email} icon={<Mail className="h-3.5 w-3.5" />} managed lockNote="Login identity — cannot be changed" />
          <Row label="Phone" value={phone} icon={<Phone className="h-3.5 w-3.5" />} />

          {role === "student" && (
            <>
              <Row label="USN" value={data?.student?.usn ?? "Not assigned"} managed />
              <Row label="Branch" value={data?.student?.branches?.name ?? "Not assigned"} managed />
              <Row
                label="Semester"
                value={data?.student?.semester != null ? `Semester ${data.student.semester}` : "—"}
                managed
              />
            </>
          )}
          {role === "teacher" && (
            <Row label="Assigned branch" value={data?.teacher?.branches?.name ?? "Not assigned"} managed />
          )}
          {role === "admin" && <Row label="Role" value="Administrator" managed />}
        </dl>
      </section>
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
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
        {managed && (
          <span className="ml-1 inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
            <Lock className="h-2.5 w-2.5" /> {lockNote ?? "Managed by admin"}
          </span>
        )}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

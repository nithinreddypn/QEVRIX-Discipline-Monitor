import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, GraduationCap, Mail, User,
  UsersRound, X, Phone, IdCard, Building2, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layouts/AuthLayout";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — QEVRIX Discipline Monitor" },
      { name: "description", content: "Create a student or teacher account for the QEVRIX Discipline Monitor." },
      { property: "og:title", content: "Create account — QEVRIX" },
      { property: "og:description", content: "Create a QEVRIX student or teacher account." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

type Rule = { label: string; test: (p: string) => boolean };
const rules: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
  { label: "One symbol (!@#$…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** USN must start with 1GA, followed by 2-digit year, 2-3 letter branch code, 3-digit roll number. e.g. 1GA22IS001 or 1GA22ISE001 */
const USN_REGEX = /^1GA\d{2}[A-Z]{2,3}\d{3}$/;
const isValidUsn = (v: string) => USN_REGEX.test(v);

type Role = "student" | "teacher";

function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [usn, setUsn] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [semester, setSemester] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signUpSuccessEmail, setSignUpSuccessEmail] = useState<string | null>(null);

  const branches = useQuery({
    queryKey: ["signup-branches"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return data ?? [];
    },
  });

  // Auto-detect branch from USN branch code (e.g. IS in 1GA22IS001 → ISE branch)
  const usnBranchCode = useMemo(() => {
    const match = usn.match(/^1GA\d{2}([A-Z]{2,3})\d{3}$/);
    return match ? match[1] : null;
  }, [usn]);

  // Auto-select branch when USN branch code changes and branches are loaded
  useEffect(() => {
    if (role !== "student" || !usnBranchCode || !branches.data?.length) return;
    const matched = branches.data.find((b) => {
      const dbCode = b.code.toUpperCase();
      const code = usnBranchCode.toUpperCase();
      return (
        dbCode.startsWith(code) ||
        code.startsWith(dbCode) ||
        (code === "AM" && dbCode === "AIML") ||
        (code === "AI" && dbCode === "AIML")
      );
    });
    if (matched && matched.id !== branchId) {
      setBranchId(matched.id);
    }
  }, [usnBranchCode, branches.data, role]);

  const passed = useMemo(() => rules.map((r) => r.test(password)), [password]);
  const score = passed.filter(Boolean).length;
  const strengthColor = [
    "bg-muted", "bg-destructive/70", "bg-amber-500",
    "bg-amber-400", "bg-primary/80", "bg-primary",
  ][score];
  const strengthLabel = ["", "Very weak", "Weak", "Fair", "Strong", "Excellent"][score];
  const matches = confirm.length > 0 && confirm === password;
  const usnValid = isValidUsn(usn);
  const baseValid =
    score >= 4 && matches && accepted && !loading &&
    fullName.trim() && email.trim() && branchId;
  const canSubmit = role === "student"
    ? baseValid && usnValid && semester
    : baseValid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      if (role === "student" && usn.trim() && !usnValid)
        return toast.error("Invalid USN format. Expected: 1GA + 2-digit year + 2-3 letter branch + 3-digit roll (e.g. 1GA22IS001 or 1GA22ISE001)");
      if (score < 4) return toast.error("Please choose a stronger password");
      if (!matches) return toast.error("Passwords do not match");
      if (!accepted) return toast.error("Please accept the Terms and Privacy Policy");
      return toast.error("Please fill in all required fields");
    }
    setLoading(true);

    // Sign up the user. All user details are stored in raw_user_meta_data so the SECURITY DEFINER database trigger
    // can create their student/teacher record securely on the backend (even if their email is unconfirmed).
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          role,
          phone: phone || null,
          branch_id: branchId || null,
          usn: role === "student" ? usn : null,
          semester: role === "student" ? Number(semester) : null,
          profile_photo_path: null,
        },
      },
    });

    if (error || !signUpData.user) {
      setLoading(false);
      toast.error(error?.message ?? "Sign up failed");
      return;
    }

    // Create the student/teacher record on the server using service role key.
    // This is more reliable than the database trigger which may not be configured.
    try {
      const { createStudentRecord } = await import("@/lib/email");
      await createStudentRecord({
        data: {
          userId: signUpData.user.id,
          email,
          fullName,
          role,
          usn: role === "student" ? usn : undefined,
          branchId: branchId || undefined,
          semester: role === "student" ? Number(semester) : undefined,
          phone: phone || undefined,
        }
      });
    } catch (recordErr) {
      console.error("[Signup] Failed to create record via server:", recordErr);
      // Don't block signup — the trigger might have created the record
    }

    setLoading(false);
    toast.success("Registration successful! Verification email sent.");
    setSignUpSuccessEmail(email);
  }

  return (
    <AuthLayout
      eyebrow="Create your account"
      title="Join the QEVRIX network."
      subtitle="Set up your profile in under a minute. Your account will be verified by your teacher or administrator before activation."
    >
      <div className="card-surface relative overflow-hidden p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {role === "student" ? "Student registration" : "Teacher registration"}
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {role === "student"
            ? "Your branch teacher will review and approve your profile."
            : "An administrator will review and approve your profile."}
        </p>

        {signUpSuccessEmail ? (
          <div className="mt-6 space-y-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-8 w-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Confirm your email address</h2>
              <p className="text-sm text-muted-foreground">
                We sent a verification link to <strong className="text-foreground">{signUpSuccessEmail}</strong>.
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-sm mx-auto">
                Please click the link inside the email to verify your email address. Once verified, your signup request will automatically be sent to the department teachers for approval.
              </p>
            </div>
            <div className="pt-4">
              <Link
                to="/login"
                className="btn-primary inline-flex items-center justify-center gap-1.5 px-6"
              >
                Go to Log In
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Role toggle */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-input bg-secondary p-1">
              <RoleTab active={role === "student"} onClick={() => setRole("student")} icon={<GraduationCap className="h-4 w-4" />}>
                Student
              </RoleTab>
              <RoleTab active={role === "teacher"} onClick={() => setRole("teacher")} icon={<UsersRound className="h-4 w-4" />}>
                Teacher
              </RoleTab>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <IconField label="Full name" icon={User} value={fullName} onChange={setFullName} required placeholder="Your name" />
                <IconField label="Email" icon={Mail} type="email" value={email} onChange={setEmail} required autoComplete="email" placeholder="you@institute.edu" />
              </div>

              {role === "student" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <IconField label="USN" icon={IdCard} value={usn} onChange={(v) => setUsn(v.toUpperCase())} required placeholder="1GA22IS001" />
                    {usn.length > 0 && (
                      <p
                        className={[
                          "mt-1 flex items-center gap-1 text-[11px] font-medium transition-colors",
                          usnValid ? "text-primary" : "text-destructive",
                        ].join(" ")}
                      >
                        {usnValid
                          ? <><Check className="h-3 w-3" strokeWidth={3} /> Valid USN{usnBranchCode ? ` · ${branches.data?.find(b => {
                              const dbCode = b.code.toUpperCase();
                              const code = usnBranchCode.toUpperCase();
                              return dbCode.startsWith(code) || code.startsWith(dbCode) || (code === "AM" && dbCode === "AIML") || (code === "AI" && dbCode === "AIML");
                            })?.name ?? usnBranchCode}` : ""}</>
                          : <><X className="h-3 w-3" strokeWidth={2.5} /> Format: 1GA + year(2) + branch(2-3) + roll(3)</>}
                      </p>
                    )}
                  </div>
                  <SelectField
                    label="Semester"
                    icon={GraduationCap}
                    value={semester}
                    onChange={setSemester}
                    required
                    options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `Semester ${n}` }))}
                    placeholder="Select semester"
                  />
                </div>
              )}

              <SelectField
                label={role === "teacher" ? "Branch / Department" : "Branch"}
                icon={Building2}
                value={branchId}
                onChange={setBranchId}
                required
                options={(branches.data ?? []).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
                placeholder={branches.isLoading ? "Loading branches…" : "Select your branch"}
              />

              <IconField label="Phone" icon={Phone} value={phone} onChange={setPhone} placeholder="Optional" />

              {/* Passwords */}
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
                <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              </div>

              {password.length > 0 && (
                <div className="rounded-lg border border-border bg-[color:var(--color-surface)] p-3">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="uppercase tracking-wider text-muted-foreground">Password strength</span>
                    <span className={score >= 4 ? "text-primary" : "text-muted-foreground"}>{strengthLabel}</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={[
                          "h-1.5 flex-1 rounded-full transition-all duration-500 ease-out",
                          i < score ? strengthColor : "bg-muted",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    {rules.map((r, i) => (
                      <li
                        key={r.label}
                        className={
                          passed[i]
                            ? "flex items-center gap-1 text-primary"
                            : "flex items-center gap-1 text-muted-foreground"
                        }
                      >
                        {passed[i] ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" />}
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confirm.length > 0 && (
                <div
                  className={[
                    "flex items-center gap-1.5 text-[11px] font-medium",
                    matches ? "text-primary" : "text-destructive",
                  ].join(" ")}
                >
                  {matches
                    ? <><Check className="h-3 w-3" strokeWidth={3} /> Passwords match</>
                    : <><X className="h-3 w-3" strokeWidth={2.5} /> Passwords do not match</>}
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create account"}
                {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

function RoleTab({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {icon} {children}
    </button>
  );
}

function IconField({
  label, type = "text", icon: Icon, value, onChange, required, autoComplete, placeholder,
}: {
  label: string; type?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string; onChange: (v: string) => void;
  required?: boolean; autoComplete?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <div className="relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="grid w-10 place-items-center text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
    </label>
  );
}

function PasswordField({
  label, value, onChange, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <div className="relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="grid w-10 place-items-center text-muted-foreground">
          <KeyRound className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <input
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="w-full bg-transparent py-2.5 pr-2 text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex h-auto w-10 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function SelectField({
  label, icon: Icon, value, onChange, required, options, placeholder,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string; onChange: (v: string) => void; required?: boolean;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <div className="relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="grid w-10 place-items-center text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent py-2.5 pr-3 text-sm outline-none"
        >
          <option value="">{placeholder ?? "Select…"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </label>
  );
}



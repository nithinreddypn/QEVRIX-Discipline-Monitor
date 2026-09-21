import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Mail,
  Check,
  X,
  Sparkles,
  Copy,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { AuthLayout } from "@/components/layouts/AuthLayout";

interface ResetPasswordSearch {
  token_hash?: string;
  type?: string;
  email?: string;
  code?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => {
    return {
      token_hash: typeof search.token_hash === "string" ? search.token_hash : undefined,
      type: typeof search.type === "string" ? search.type : undefined,
      email: typeof search.email === "string" ? search.email : undefined,
      code: typeof search.code === "string" ? search.code : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Reset Password — QEVRIX" },
      { name: "description", content: "Choose a new password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordRules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p: string) => /\d/.test(p) },
  { label: "One symbol (!@#$%^&*…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function generateStrongPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()_+-=[]{};:?";
  const all = uppers + lowers + numbers + symbols;

  // Guarantee multiple characters from each category for strict policy compliance
  const chars = [
    uppers[Math.floor(Math.random() * uppers.length)],
    uppers[Math.floor(Math.random() * uppers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  while (chars.length < 16) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Status can be: 'verifying' | 'ready' | 'manual_otp'
  const [status, setStatus] = useState<"verifying" | "ready" | "manual_otp">("verifying");
  const [statusMessage, setStatusMessage] = useState("Verifying security token...");
  const [email, setEmail] = useState(search.email || "");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Password rules validation
  const passedRules = useMemo(() => passwordRules.map((r) => r.test(password)), [password]);
  const score = useMemo(() => passedRules.filter(Boolean).length, [passedRules]);
  const allRulesPassed = score === passwordRules.length;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const strengthLabel = useMemo(() => {
    if (score === 0) return "Enter password";
    if (score <= 2) return "Too weak";
    if (score === 3) return "Fair";
    if (score === 4) return "Good";
    return "Strong";
  }, [score]);

  const strengthColor = useMemo(() => {
    if (score <= 2) return "bg-destructive";
    if (score === 3) return "bg-amber-500";
    if (score === 4) return "bg-blue-500";
    return "bg-primary";
  }, [score]);

  useEffect(() => {
    let active = true;

    async function initializeRecovery() {
      // 1. If we have a direct token_hash in search params (from direct email link)
      if (search.token_hash && search.type === "recovery") {
        setStatusMessage("Verifying your reset link...");
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: search.token_hash,
            type: "recovery",
          });
          if (!active) return;
          if (error) {
            console.error("[ResetPassword] verifyOtp error:", error);
            toast.error(getFriendlyErrorMessage(error));
            setStatus("manual_otp");
            return;
          }
          if (data.session) {
            toast.success("Identity verified. Set your new password.");
            setStatus("ready");
            return;
          }
        } catch (err: any) {
          if (!active) return;
          console.error("[ResetPassword] verifyOtp exception:", err);
          setStatus("manual_otp");
          return;
        }
      }

      // 2. If we have an OAuth / PKCE code in search params
      if (search.code) {
        setStatusMessage("Exchanging authentication code...");
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (!active) return;
          if (error) {
            console.error("[ResetPassword] exchangeCode error:", error);
            setStatus("manual_otp");
            return;
          }
          if (data.session) {
            setStatus("ready");
            return;
          }
        } catch (err: any) {
          if (!active) return;
          setStatus("manual_otp");
          return;
        }
      }

      // 3. Check for active session (e.g. from existing auth or hash fragment)
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setStatus("ready");
        return;
      }

      // 4. Listen for auth state change in case Supabase is parsing hash fragments asynchronously
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && s)) {
          setStatus("ready");
        }
      });

      // Give hash parsing 1.5 seconds, otherwise fallback to manual OTP input
      const timer = setTimeout(() => {
        if (active) {
          setStatus((prev) => (prev === "verifying" ? "manual_otp" : prev));
        }
      }, 1500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    initializeRecovery();

    return () => {
      active = false;
    };
  }, [search.token_hash, search.type, search.code]);

  const handleSuggestPassword = () => {
    const generated = generateStrongPassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setShow(true);
    setShowConfirm(true);
    try {
      navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Strong password suggested and copied to clipboard!");
    } catch {
      toast.success("Strong password generated!");
    }
  };

  const handleCopy = () => {
    if (!password) return;
    try {
      navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Password copied to clipboard!");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your account email");
      return;
    }
    if (!otp.trim()) {
      toast.error("Please enter the 8-digit verification code");
      return;
    }

    setOtpLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "recovery",
      });

      if (error) {
        toast.error(getFriendlyErrorMessage(error));
      } else if (data.session) {
        toast.success("Code verified! Please enter your new password below.");
        setStatus("ready");
      }
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setOtpLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRulesPassed) {
      toast.error("Please ensure your password meets all the security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(getFriendlyErrorMessage(error));
      } else {
        toast.success("Password updated successfully! Please sign in with your new password.");
        // Sign out to clear the recovery session and force clean login
        await supabase.auth.signOut();
        navigate({ to: "/login", replace: true });
      }
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="card-surface relative overflow-hidden p-7 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </Link>

        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Secure Account
        </div>

        {status === "verifying" && (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">Verifying Reset Link</h2>
            <p className="mt-1 text-xs text-muted-foreground">{statusMessage}</p>
            <button
              type="button"
              onClick={() => setStatus("manual_otp")}
              className="mt-6 text-xs text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Have a code? Enter it manually
            </button>
          </div>
        )}

        {status === "manual_otp" && (
          <div className="mt-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Verify Reset Code</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your account email and the 8-digit verification code from your reset email.
            </p>

            <form onSubmit={onVerifyOtp} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Account Email</span>
                <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="grid w-10 place-items-center text-muted-foreground">
                    <Mail className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@institute.edu"
                    className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">8-Digit Verification Code</span>
                <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="grid w-10 place-items-center text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
                    placeholder="12345678"
                    className="w-full bg-transparent py-2.5 pr-3 font-mono text-sm tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground/70"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={otpLoading}
                className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {otpLoading ? "Verifying code…" : "Verify code"}
                {!otpLoading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Need a new reset link? Click here
                </Link>
              </div>
            </form>
          </div>
        )}

        {status === "ready" && (
          <div className="mt-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Set new password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Create a new, strong password to secure your monitor access.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* 1. NEW PASSWORD FIELD */}
              <div className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">New Password</span>
                  <button
                    type="button"
                    onClick={handleSuggestPassword}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    title="Generate a strong, secure password meeting all requirements"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggest strong password
                  </button>
                </div>

                <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="grid w-10 place-items-center text-muted-foreground">
                    <KeyRound className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent py-2.5 pr-2 text-sm outline-none placeholder:text-muted-foreground/70"
                  />
                  {password.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex h-auto w-9 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      aria-label="Copy password"
                      title={copied ? "Copied!" : "Copy password"}
                    >
                      {copied ? <CheckCheck className="h-4 w-4 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
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
              </div>

              {/* 2. IN-BETWEEN: LIVE REQUIREMENTS CHECKLIST & STRENGTH INDICATOR */}
              <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 transition-all">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="uppercase tracking-wider text-muted-foreground">Password requirements</span>
                  <span className={score === 5 ? "font-semibold text-primary" : "text-muted-foreground"}>
                    {strengthLabel} {score > 0 && `(${score}/5)`}
                  </span>
                </div>

                {/* 5-Segment Strength Bar */}
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={[
                        "h-1.5 flex-1 rounded-full transition-all duration-300",
                        i < score ? strengthColor : "bg-border/60",
                      ].join(" ")}
                    />
                  ))}
                </div>

                {/* Live Requirements List */}
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-[11px]">
                  {passwordRules.map((r, i) => {
                    const isPassed = passedRules[i];
                    return (
                      <li
                        key={r.label}
                        className={[
                          "flex items-center gap-1.5 transition-colors duration-200",
                          isPassed ? "font-medium text-primary" : "text-muted-foreground/80",
                        ].join(" ")}
                      >
                        {isPassed ? (
                          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-primary/15 text-primary">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-muted text-muted-foreground">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                          </span>
                        )}
                        <span>{r.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* 3. CONFIRM PASSWORD FIELD */}
              <div className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Confirm Password</span>
                <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="grid w-10 place-items-center text-muted-foreground">
                    <KeyRound className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="flex h-auto w-10 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Live Match Feedback */}
                {confirmPassword.length > 0 && (
                  <div
                    className={[
                      "mt-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors",
                      passwordsMatch ? "text-primary" : "text-destructive",
                    ].join(" ")}
                  >
                    {passwordsMatch ? (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5" />
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 4. SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading || !allRulesPassed || !passwordsMatch}
                className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Updating password…" : "Reset password"}
                {!loading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

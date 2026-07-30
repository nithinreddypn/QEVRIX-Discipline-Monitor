import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { KeyRound, Eye, EyeOff, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { AuthLayout } from "@/components/layouts/AuthLayout";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — QEVRIX" },
      { name: "description", content: "Choose a new password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Verify that the user arrived here with a valid recovery token/session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Sometimes Supabase auth takes a moment to process the hash in the URL.
        // Let's listen for auth state changes as well.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" || session) {
              subscription.unsubscribe();
            }
          }
        );
      }
    };
    checkSession();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
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
        // Sign out to clear the recovery session and force login
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
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Secure Account
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Set new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Create a new, strong password to secure your monitor access.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">New Password</span>
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
                className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
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

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Confirm Password</span>
            <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <span className="grid w-10 place-items-center text-muted-foreground">
                <KeyRound className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <input
                type={show ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loading ? "Updating password…" : "Reset password"}
            {!loading && (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}

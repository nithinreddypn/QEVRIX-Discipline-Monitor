import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { sendRecoveryEmail } from "@/lib/email";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — QEVRIX" },
      { name: "description", content: "Reset your QEVRIX password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendRecoveryEmail({
        data: {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }
      });

      setSent(true);
      toast.success("Password reset email sent");
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
          Reset Password
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Forgot password?</h1>
        
        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We have sent a password reset link to <strong className="text-foreground">{email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Please check your inbox (and spam folder) and follow the instructions to set a new password.
            </p>
            <button
              onClick={() => setSent(false)}
              className="btn-ghost w-full text-sm"
            >
              Try another email
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-muted-foreground">
              No worries, it happens. Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Email</span>
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

              <button
                type="submit"
                disabled={loading}
                className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {loading ? "Sending link…" : "Send reset link"}
                {!loading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { fetchPrimaryRole, roleHome } from "@/lib/roles";
import { AuthLayout } from "@/components/layouts/AuthLayout";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — QEVRIX Discipline Monitor" },
      { name: "description", content: "Sign in to your QEVRIX account." },
      { property: "og:title", content: "Sign in — QEVRIX" },
      { property: "og:description", content: "Sign in to your QEVRIX account." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});


function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    const uid = data.user?.id;
    const role = uid ? await fetchPrimaryRole(uid) : "student";
    setLoading(false);
    toast.success("Signed in");
    navigate({ to: roleHome(role), replace: true });
  }

  return (
    <AuthLayout>
      <div className="card-surface relative overflow-hidden p-7 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Sign in
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your credentials to access your discipline monitor.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <IconInput
            label="Email"
            type="email"
            icon={Mail}
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
            placeholder="you@institute.edu"
          />
          <div>
            <IconInput
              label="Password"
              labelAction={
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary transition-colors hover:text-primary/80 font-medium"
                >
                  Forgot password?
                </Link>
              }
              type={show ? "text" : "password"}
              icon={KeyRound}
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              trailing={
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="flex h-auto w-10 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary group inline-flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
            {!loading && (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          New to QEVRIX?
          <span className="h-px flex-1 bg-border" />
        </div>
        <Link
          to="/signup"
          className="btn-ghost mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm"
        >
          Create an account <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

    </AuthLayout>
  );
}

function IconInput({
  label,
  labelAction,
  type,
  icon: Icon,
  value,
  onChange,
  required,
  autoComplete,
  placeholder,
  trailing,
}: {
  label: string;
  labelAction?: React.ReactNode;
  type: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {labelAction}
      </div>
      <div className="group relative flex items-stretch overflow-hidden rounded-md border border-input bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="grid w-10 place-items-center text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <input
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {trailing}
      </div>
    </label>
  );
}

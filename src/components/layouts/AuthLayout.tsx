import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Radar, Users, Building2 } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
};

export function AuthLayout({
  children,
  eyebrow = "QEVRIX · Discipline Monitor",
  title = "Institutional discipline, quietly automated.",
  subtitle = "AI-assisted identification and branch verification for the Department of Information Science and Engineering.",
}: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 15% 10%, rgb(34 197 94 / 0.10), transparent 65%), radial-gradient(45% 45% at 90% 90%, rgb(34 197 94 / 0.08), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--color-border)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--color-border)_60%,transparent)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />

      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left: brand panel */}
        <aside className="relative hidden flex-col justify-between px-10 py-10 lg:flex xl:px-14">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">QEVRIX</span>
          </Link>

          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              {eyebrow}
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight leading-[1.1] xl:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{subtitle}</p>

            {/* Feature chips */}
            <ul className="mt-8 space-y-3">
              {[
                { icon: Radar, title: "Live detections", desc: "Real-time recognition across gates." },
                { icon: Users, title: "Role-aware access", desc: "Students, teachers, and administrators." },
                { icon: Building2, title: "Branch verification", desc: "Lanyard colour matched to department." },
              ].map((f) => (
                <li
                  key={f.title}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition hover:border-primary/40 hover:bg-card"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--color-surface)] ring-1 ring-border">
                    <f.icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              System operational
            </div>
            <div>Global Academy of Technology · ISE</div>
          </div>
        </aside>

        {/* Right: form panel */}
        <main className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          {/* Mobile brand */}
          <Link to="/" className="mb-8 flex items-center gap-2.5 self-center lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">QEVRIX</span>
          </Link>

          <div className="mx-auto w-full max-w-md">{children}</div>

          <p className="mx-auto mt-8 max-w-md text-center text-[11px] text-muted-foreground">
            Protected by role-scoped access controls. By continuing you agree to our{" "}
            <Link to="/terms" className="underline decoration-dotted hover:text-foreground">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline decoration-dotted hover:text-foreground">Privacy Policy</Link>.
          </p>
        </main>
      </div>
    </div>
  );
}

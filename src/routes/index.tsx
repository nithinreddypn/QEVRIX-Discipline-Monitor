import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  Camera,
  ChevronDown,
  IdCard,
  LayoutDashboard,
  ScanFace,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { MarketingShell } from "@/components/layouts/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QEVRIX Discipline Monitor — Automatic student entry monitoring" },
      {
        name: "description",
        content:
          "QEVRIX automatically identifies students entering campus, verifies their ID and branch, and notifies the right people — instantly.",
      },
      { property: "og:title", content: "QEVRIX Discipline Monitor" },
      {
        property: "og:description",
        content:
          "Automatic student identification and instant campus discipline notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ScanFace, label: "Student Identification" },
  { icon: IdCard, label: "ID Card Verification" },
  { icon: Building2, label: "Branch Detection" },
  { icon: Bell, label: "Automatic Notifications" },
  { icon: LayoutDashboard, label: "Centralized Dashboard" },
  { icon: Sparkles, label: "AI Powered Monitoring" },
];

const STEPS = [
  { icon: Camera, title: "Camera captures entry", body: "A smart camera at the gate records every arrival." },
  { icon: ScanFace, title: "System identifies the student", body: "Each face is matched to a registered student." },
  { icon: ShieldCheck, title: "Verifies ID & branch", body: "ID card and branch are automatically confirmed." },
  { icon: Bell, title: "Notifies instantly", body: "Student, teacher and admin are alerted in real time." },
];

function Landing() {
  return (
    <MarketingShell transparentTop>
      {/* Hero — full-screen campus */}
      <section className="relative h-screen min-h-[640px] w-full overflow-hidden">
        <img
          src="/campus-hero.png"
          alt="Global Academy of Technology campus"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        {/* Gradient overlays for legibility */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.25) 35%, rgba(15,23,42,0.55) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 40%, rgba(34,197,94,0.18), transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Intelligent campus entry monitoring
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)] sm:text-6xl md:text-7xl">
            Automatically identify students
            <br />
            <span className="text-primary">and notify the right people.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            QEVRIX recognises each student entering campus, verifies their ID and branch,
            and instantly informs students, teachers and administrators — all from a
            single, calm dashboard.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/login" className="btn-primary inline-flex items-center gap-1.5 text-sm">
              Login <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
            >
              See how it works
            </a>
          </div>
        </div>

        <a
          href="#key-capabilities"
          aria-label="Scroll to content"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/80 hover:text-white"
        >
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </a>
      </section>

      {/* Key Features */}
      <section id="key-capabilities" className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Capabilities
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Key capabilities
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Everything a modern campus needs to stay in the loop — quietly working in the background.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="card-surface card-hover group relative flex items-center gap-4 overflow-hidden p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-primary transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="text-[15px] font-medium">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-[color:var(--color-surface)]/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">Four steps. No manual checking required.</p>
          </div>
          <ol className="relative grid gap-6 md:grid-cols-4">
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="card-surface flex h-full flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm">
                      {i + 1}
                    </span>
                    <s.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dashboard preview — mirrors real Admin control room */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Control room preview
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            A calm, centralized view
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every entry, verification and alert — unified in one institutional-grade dashboard.
          </p>
        </div>

        <div className="glass-panel relative rounded-2xl p-2.5 shadow-[var(--shadow-glass)] sm:p-3">
          {/* Window chrome */}
          <div className="flex items-center justify-between rounded-t-xl bg-[color:var(--color-surface)]/70 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
              <ShieldCheck className="h-3 w-3 text-primary" />
              qevrix.app / admin / dashboard
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">Live · 08:42</div>
          </div>

          <div className="rounded-b-xl border border-border bg-card p-5 sm:p-6">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border pb-5 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Control room
                </div>
                <h3 className="mt-2 truncate font-display text-lg font-semibold tracking-tight">
                  Admin Dashboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Institution-wide visibility across every branch.
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-border bg-[color:var(--color-surface)]/60 px-3 py-2 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  System
                </div>
                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-xs font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Operational
                </div>
              </div>
            </div>

            {/* KPI grid — mirrors AdminDashboard */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total Students", value: "1,248", icon: Users, tone: "primary" as const },
                { label: "Today's Detections", value: "312", icon: ScanLine, tone: "primary" as const },
                { label: "Without ID", value: "6", icon: UserRound, tone: "amber" as const },
                { label: "Unknown Persons", value: "2", icon: Activity, tone: "amber" as const },
                { label: "Unread Alerts", value: "27", icon: Bell, tone: "primary" as const },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-border bg-[color:var(--color-surface)]/50 p-4 transition hover:border-primary/40 hover:bg-[color:var(--color-surface)]/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </div>
                    <span
                      className={[
                        "grid h-7 w-7 place-items-center rounded-lg",
                        k.tone === "amber"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary/10 text-primary",
                      ].join(" ")}
                    >
                      <k.icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent activity table */}
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-[color:var(--color-surface)]/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <div className="text-sm font-semibold">Recent activity</div>
                    <div className="text-[11px] text-muted-foreground">
                      Latest detections across all branches
                    </div>
                  </div>
                </div>
                <span className="hidden text-[11px] font-medium text-primary sm:inline">
                  View all →
                </span>
              </div>

              <div className="hidden grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.8fr] gap-3 border-b border-border bg-[color:var(--color-surface)]/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <div>Student</div>
                <div>Branch</div>
                <div>ID Card</div>
                <div>Time</div>
                <div className="text-right">Status</div>
              </div>

              <ul className="divide-y divide-border">
                {[
                  { name: "Aditi Rao", branch: "Information Science", code: "ISE", id: true, time: "08:41", status: "Verified" },
                  { name: "Rahul Menon", branch: "Mechanical", code: "ME", id: true, time: "08:39", status: "Verified" },
                  { name: "Sana Iqbal", branch: "Electronics", code: "ECE", id: true, time: "08:36", status: "Review" },
                  { name: "Unknown person", branch: "—", code: "—", id: false, time: "08:33", status: "Alert" },
                ].map((r) => (
                  <li
                    key={r.name + r.time}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm transition hover:bg-[color:var(--color-surface)]/40 md:grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.8fr]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-primary ring-1 ring-primary/10">
                        {r.id ? (
                          <UserCheck className="h-4 w-4" />
                        ) : (
                          <UserRound className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground md:hidden">
                          {r.branch} · {r.time}
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 items-center gap-2 md:flex">
                      <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {r.code}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{r.branch}</span>
                    </div>
                    <div className="hidden items-center gap-1.5 text-xs md:flex">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.id ? "bg-primary" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-muted-foreground">{r.id ? "Found" : "Missing"}</span>
                    </div>
                    <div className="hidden text-xs tabular-nums text-muted-foreground md:block">
                      {r.time}
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          r.status === "Verified"
                            ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                            : r.status === "Alert"
                              ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                              : "bg-secondary text-muted-foreground ring-1 ring-border"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            r.status === "Verified"
                              ? "bg-primary"
                              : r.status === "Alert"
                                ? "bg-amber-500"
                                : "bg-muted-foreground/60"
                          }`}
                        />
                        {r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer legend */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Verified
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Needs review
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" /> Pending
                </span>
              </div>
              <span className="tabular-nums">Auto-refreshing · 5s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Team teaser */}
      <section className="border-t border-border bg-[color:var(--color-surface)]/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
            <Users className="h-5 w-5" />
          </span>
          <h2 className="text-3xl font-semibold tracking-tight">Built by a dedicated student team</h2>
          <p className="max-w-xl text-muted-foreground">
            Meet the guide and the students behind QEVRIX Discipline Monitor.
          </p>
          <Link to="/team" className="btn-ghost inline-flex items-center gap-1.5 text-sm">
            Meet the team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-border bg-[color:var(--color-surface)]/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgb(34 197 94 / 0.08), transparent 70%)",
        }}
      />

      {/* CTA band */}
      <div className="mx-auto max-w-7xl px-6 pt-16">
        <div className="glass-panel flex flex-col items-start justify-between gap-5 rounded-2xl p-6 shadow-[var(--shadow-glass)] md:flex-row md:items-center md:p-8">
          <div>
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Ready to modernise campus entry?
            </h3>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Sign in to explore the dashboard, or reach out to bring QEVRIX to your institution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/contact" className="btn-ghost inline-flex items-center gap-1.5 text-sm">
              Contact us
            </Link>
            <Link to="/login" className="btn-primary inline-flex items-center gap-1.5 text-sm">
              Login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              QEVRIX Discipline Monitor
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Automatic student identification, ID and branch verification, and instant
            campus notifications — quietly working in the background.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Institutional-grade
            </span>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explore
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/" className="text-foreground/80 hover:text-primary">Home</Link></li>
            <li><Link to="/about" className="text-foreground/80 hover:text-primary">About</Link></li>
            <li><Link to="/features" className="text-foreground/80 hover:text-primary">Features</Link></li>
            <li><Link to="/technology" className="text-foreground/80 hover:text-primary">Technology</Link></li>
            <li><Link to="/team" className="text-foreground/80 hover:text-primary">Team</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-foreground/80">
            <li className="font-medium text-foreground">Global Academy of Technology</li>
            <li>Department of Information Science and Engineering</li>
            <li>
              <a
                href="mailto:global.iseservice@gmail.com"
                className="inline-flex items-center gap-1.5 hover:text-primary"
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-primary">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                </span>
                global.iseservice@gmail.com
              </a>
            </li>
            <li>
              <Link to="/contact" className="text-primary hover:underline">
                Send us a message →
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© {year} QEVRIX · All rights reserved</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
            <Link to="/terms" className="hover:text-primary">Terms</Link>
            <span className="hidden sm:inline">·</span>
            <span>Built with care by the QEVRIX team</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, User, Building2, MapPin, Mail, Sparkles } from "lucide-react";
import { MarketingShell } from "@/components/layouts/AppShell";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — QEVRIX Discipline Monitor" },
      {
        name: "description",
        content:
          "Meet the guide and the student team behind QEVRIX Discipline Monitor — Department of Information Science and Engineering, Global Academy of Technology.",
      },
      { property: "og:title", content: "QEVRIX Team" },
      {
        property: "og:description",
        content: "The people building QEVRIX Discipline Monitor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

const GUIDE = {
  name: "Dr. Vimuktha E Salis",
  role: "Professor",
  department: "Department of Information Science and Engineering",
};

const MEMBERS = [
  { name: "Yashas A", initials: "YA" },
  { name: "Ananya Ram J", initials: "AR" },
  { name: "Chiranjeevi G", initials: "CG" },
];

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MemberCard({ name }: { name: string }) {
  return (
    <article className="card-surface card-hover group relative flex flex-col items-center overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-16 h-40 opacity-70"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 50%, rgb(34 197 94 / 0.10), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="absolute -inset-1 rounded-full bg-[conic-gradient(from_180deg,rgb(34_197_94/0.35),transparent_60%,rgb(34_197_94/0.35))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[color:var(--color-surface)] ring-1 ring-border">
          <span className="font-display text-2xl font-semibold text-primary">
            {initialsFromName(name)}
          </span>
        </div>
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{name}</h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Student Developer
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-[color:var(--color-surface)] px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        ISE · Final Year
      </div>
    </article>
  );
}

function TeamPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, rgb(34 197 94 / 0.10), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Our team
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            The people behind QEVRIX
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Department of Information Science and Engineering · Global Academy of Technology
          </p>
        </div>
      </section>

      {/* Guide — centered feature card */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-5 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-border" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Guided by
          </span>
          <span className="h-px w-10 bg-border" />
        </div>

        <div className="relative mx-auto max-w-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] opacity-70"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 40%, rgb(34 197 94 / 0.12), transparent 70%)",
            }}
          />
          <article className="card-surface relative overflow-hidden p-8 text-center sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
            />
            <div className="mx-auto flex flex-col items-center">
              <div className="relative">
                <div className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_140deg,rgb(34_197_94/0.45),transparent_55%,rgb(34_197_94/0.45))]" />
                <div className="relative grid h-28 w-28 place-items-center rounded-full bg-[color:var(--color-surface)] ring-1 ring-border">
                  <GraduationCap className="h-11 w-11 text-primary" strokeWidth={1.75} />
                </div>
              </div>

              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> Project Guide
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {GUIDE.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-primary">{GUIDE.role}</p>
              <p className="mt-1 text-sm text-muted-foreground">{GUIDE.department}</p>
            </div>
          </article>
        </div>
      </section>

      {/* Team members — 3 cards centered */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-5 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-border" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Team Members
          </span>
          <span className="h-px w-10 bg-border" />
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBERS.map((m) => (
            <MemberCard key={m.name} name={m.name} />
          ))}
        </div>
      </section>

      {/* Institution — richer layout to fill space */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="card-surface relative overflow-hidden p-8 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, rgb(34 197 94 / 0.15), transparent 70%)",
            }}
          />
          <div className="grid gap-8 md:grid-cols-[1fr_auto_1.1fr] md:items-center">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-surface)] ring-1 ring-border">
                <Building2 className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Institution
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight">
                  Global Academy of Technology
                </div>
                <div className="text-sm text-muted-foreground">
                  Department of Information Science and Engineering
                </div>
              </div>
            </div>

            <div className="hidden h-24 w-px bg-border md:block" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Campus
                  </div>
                  <div className="text-sm font-medium">Rajarajeshwari Nagar, Bengaluru</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Department Contact
                  </div>
                  <div className="truncate text-sm font-medium">global.iseservice@gmail.com</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              An academic project · Built for the Department of ISE
            </div>
            <div className="font-medium">QEVRIX · Discipline Monitor</div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, Lightbulb, Sparkles, Target } from "lucide-react";
import { MarketingShell } from "@/components/layouts/AppShell";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — QEVRIX Discipline Monitor" },
      {
        name: "description",
        content:
          "Why QEVRIX exists: automatic student identification, reliable ID verification, and instant campus notifications for calmer discipline oversight.",
      },
      { property: "og:title", content: "About QEVRIX Discipline Monitor" },
      {
        property: "og:description",
        content: "The problem, the proposed system, objectives and benefits of QEVRIX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const SECTIONS = [
  {
    icon: AlertTriangle,
    title: "Problem Statement",
    body: "Campus entry is still monitored manually — a slow, error-prone process where unauthorised visitors, missing ID cards and branch mix-ups routinely go unnoticed. Institutions lack a reliable, real-time record of who is on campus and when.",
  },
  {
    icon: ClipboardList,
    title: "Existing System",
    body: "Most colleges rely on human guards, paper registers or basic swipe-card systems. These approaches provide no live visibility, no automatic verification, and no way to instantly alert students, teachers or administrators when something is out of place.",
  },
  {
    icon: Lightbulb,
    title: "Proposed System",
    body: "QEVRIX identifies each student as they arrive, confirms their ID card and branch, and pushes an instant notification to the student, their teacher and the administration — all visible in a single, centralized dashboard.",
  },
  {
    icon: Target,
    title: "Objectives",
    body: "Automate student recognition at entry. Verify ID and branch without manual checks. Deliver real-time, targeted notifications. Provide administrators a clear, auditable log of every arrival.",
  },
  {
    icon: Sparkles,
    title: "Benefits",
    body: "Safer campuses, faster response to irregularities, less paperwork for staff, and a calm, trustworthy record for institutions — with parents and teachers kept informed without extra effort.",
  },
];

function AboutPage() {
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
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> About the project
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            A calmer way to monitor campus entry
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            QEVRIX Discipline Monitor reimagines how campuses observe, verify and communicate
            student entry — quietly, accurately, and in real time.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <article key={s.title} className="card-surface p-7">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <s.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

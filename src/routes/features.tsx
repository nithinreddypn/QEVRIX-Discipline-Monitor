import { createFileRoute } from "@tanstack/react-router";
import { Bell, Building2, History, IdCard, LayoutDashboard, ScanFace } from "lucide-react";
import { MarketingShell } from "@/components/layouts/AppShell";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — QEVRIX Discipline Monitor" },
      {
        name: "description",
        content:
          "AI student recognition, ID card detection, branch identification, automatic notifications, admin dashboard and detection history — all in one place.",
      },
      { property: "og:title", content: "QEVRIX Features" },
      {
        property: "og:description",
        content: "Every capability that keeps campus discipline calm and automatic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  {
    icon: ScanFace,
    title: "AI Student Recognition",
    body: "Automatically identifies each student the moment they enter campus — no queues, no manual check-in.",
  },
  {
    icon: IdCard,
    title: "ID Card Detection",
    body: "Confirms that the correct ID card is being worn and matches the identified student.",
  },
  {
    icon: Building2,
    title: "Branch Identification",
    body: "Recognises the student's branch instantly, flagging any mismatch with their registered department.",
  },
  {
    icon: Bell,
    title: "Automatic Notifications",
    body: "Sends targeted alerts to the student, their teacher and the administration in real time.",
  },
  {
    icon: LayoutDashboard,
    title: "Admin Dashboard",
    body: "A single, calm interface showing live entries, verifications and alerts across every branch.",
  },
  {
    icon: History,
    title: "Detection History",
    body: "Every entry is logged and searchable — providing a clear, auditable record for the institution.",
  },
];

function FeaturesPage() {
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
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Features
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything QEVRIX does
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Designed to feel effortless for students and reliable for administrators.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="card-surface card-hover p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-primary">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

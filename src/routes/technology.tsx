import { createFileRoute } from "@tanstack/react-router";
import { Camera, Cloud, Eye, LayoutDashboard, Zap } from "lucide-react";
import { MarketingShell } from "@/components/layouts/AppShell";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/technology")({
  head: () => ({
    meta: [
      { title: "Technology — QEVRIX Discipline Monitor" },
      {
        name: "description",
        content:
          "A high-level look at the building blocks behind QEVRIX: smart cameras, AI vision, real-time recognition, a secure cloud backend and a live dashboard.",
      },
      { property: "og:title", content: "QEVRIX Technology" },
      {
        property: "og:description",
        content: "The pieces that make automatic student monitoring feel effortless.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TechnologyPage,
});

const STACK = [
  { icon: Camera, title: "ESP32-CAM smart camera", body: "A compact camera at the gate captures every entry." },
  { icon: Eye, title: "AI Vision", body: "Recognises faces and ID cards with high accuracy." },
  { icon: Zap, title: "Real-time recognition engine", body: "Processes each arrival in a fraction of a second." },
  { icon: Cloud, title: "Secure cloud backend", body: "Student records and events are stored safely and privately." },
  { icon: LayoutDashboard, title: "Live dashboard", body: "A calm, up-to-the-second view for administrators and staff." },
];

function TechnologyPage() {
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
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Technology
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            The pieces behind QEVRIX
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A simple, well-chosen set of building blocks — working together to keep campus
            entry automatic, accurate and calm.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {STACK.map((t) => (
            <article key={t.title} className="card-surface card-hover flex items-start gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <t.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-base font-semibold">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — QEVRIX" },
      { name: "description", content: "The terms governing use of QEVRIX Discipline Monitor." },
      { property: "og:title", content: "Terms of Service — QEVRIX" },
      { property: "og:description", content: "The terms governing use of QEVRIX Discipline Monitor." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/" className="mb-8 inline-flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">QEVRIX</span>
        </Link>
        <article className="card-surface prose prose-slate max-w-none p-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
          <p>By creating a QEVRIX account you agree to use the platform for its intended academic discipline-monitoring purpose within your institution.</p>
          <h2>Acceptable use</h2>
          <p>Accounts are personal. Do not share credentials or attempt to access records that do not belong to you.</p>
          <h2>Institutional data</h2>
          <p>Detection records are managed by your institution and are subject to their policies. QEVRIX processes data on their behalf.</p>
          <h2>Availability</h2>
          <p>The service is provided "as is". We work to keep it running smoothly but do not guarantee uninterrupted availability.</p>
          <p className="mt-8"><Link to="/signup" className="text-primary hover:underline">Back to sign up</Link></p>
        </article>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — QEVRIX" },
      { name: "description", content: "How QEVRIX Discipline Monitor handles your personal data." },
      { property: "og:title", content: "Privacy Policy — QEVRIX" },
      { property: "og:description", content: "How QEVRIX Discipline Monitor handles your personal data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
          <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
          <p>Your privacy matters. This policy explains what QEVRIX collects and how it is used.</p>
          <h2>What we collect</h2>
          <ul>
            <li>Account information: name, email, and (optionally) phone number.</li>
            <li>Discipline records: detection events associated with your student profile.</li>
          </ul>
          <h2>How it is used</h2>
          <p>Data is used solely to power your institution's discipline monitoring workflow — surfacing your daily status, verifying identification, and notifying the right people.</p>
          <h2>Your control</h2>
          <p>You can update your contact information at any time from Settings, and request account deletion through your institution's administrator.</p>
          <p className="mt-8"><Link to="/signup" className="text-primary hover:underline">Back to sign up</Link></p>
        </article>
      </div>
    </div>
  );
}

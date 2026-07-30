import { createFileRoute } from "@tanstack/react-router";
import { Building2, GraduationCap, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MarketingShell } from "@/components/layouts/AppShell";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — QEVRIX Discipline Monitor" },
      {
        name: "description",
        content:
          "Get in touch with the QEVRIX team at Global Academy of Technology, Department of Information Science and Engineering.",
      },
      { property: "og:title", content: "Contact QEVRIX" },
      {
        property: "og:description",
        content: "Reach out to the QEVRIX Discipline Monitor team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      (e.target as HTMLFormElement).reset();
      toast.success("Message sent", { description: "We'll get back to you soon." });
    }, 600);
  }

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
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Contact
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Questions, feedback or a collaboration in mind? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-5">
        <aside className="md:col-span-2 space-y-4">
          {[
            { icon: GraduationCap, label: "College", value: "Global Academy of Technology" },
            { icon: Building2, label: "Department", value: "Information Science and Engineering" },
            { icon: Mail, label: "Email", value: "global.iseservice@gmail.com", href: "mailto:global.iseservice@gmail.com" },
          ].map((c) => (
            <div key={c.label} className="card-surface flex items-start gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <c.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </div>
                {c.href ? (
                  <a href={c.href} className="mt-1 block text-[15px] font-medium hover:text-primary">
                    {c.value}
                  </a>
                ) : (
                  <div className="mt-1 text-[15px] font-medium">{c.value}</div>
                )}
              </div>
            </div>
          ))}
        </aside>

        <form onSubmit={handleSubmit} className="card-surface md:col-span-3 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" placeholder="Your name" required />
            <Field label="Email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <Field label="Subject" name="subject" placeholder="How can we help?" required />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Message</span>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="Write your message..."
              className="w-full resize-none rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-70"
          >
            {submitting ? "Sending..." : (<>Send message <Send className="h-4 w-4" /></>)}
          </button>
        </form>
      </section>

      <SiteFooter />
    </MarketingShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}

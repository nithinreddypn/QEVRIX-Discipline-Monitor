import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — QEVRIX" },
      { name: "description", content: "Manage your QEVRIX account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your sign-in credentials and notification preferences.
        </p>
      </header>
      <ChangePasswordCard />
      <NotificationPreferencesCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return toast.error("Password must be at least 6 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email;
    if (!email) {
      setLoading(false);
      return toast.error("No active session");
    }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyErr) {
      setLoading(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) return toast.error(error.message);
    setCurrent(""); setNext(""); setConfirm("");
    toast.success("Password updated");
  }

  return (
    <div className="card-surface p-6">
      <h2 className="text-base font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter your current password, then choose a new one.</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Field label="Current password" type="password" value={current} onChange={setCurrent} required />
        <Field label="New password" type="password" value={next} onChange={setNext} required />
        <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} required />
        <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-60">
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}


type NotifPrefs = { detections: boolean; announcements: boolean; weeklySummary: boolean };
const DEFAULT_PREFS: NotifPrefs = { detections: true, announcements: true, weeklySummary: false };

function NotificationPreferencesCard() {
  const { user } = useAuth();
  const key = user ? `qevrix:notif-prefs:${user.id}` : "";
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) });
    } catch {}
  }, [key]);

  function update(patch: Partial<NotifPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (key) localStorage.setItem(key, JSON.stringify(next));
    toast.success("Preferences saved");
  }

  return (
    <div className="card-surface p-6">
      <h2 className="text-base font-semibold">Notification preferences</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose what you want to be notified about.</p>
      <div className="mt-5 divide-y divide-border">
        <Toggle
          label="Detection alerts"
          hint="Alerts triggered by camera detections relevant to you."
          value={prefs.detections}
          onChange={(v) => update({ detections: v })}
        />
        <Toggle
          label="Announcements"
          hint="System-wide notices from administrators."
          value={prefs.announcements}
          onChange={(v) => update({ announcements: v })}
        />
        <Toggle
          label="Weekly summary"
          hint="A digest of your activity every Monday."
          value={prefs.weeklySummary}
          onChange={(v) => update({ weeklySummary: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          value
            ? "border-primary bg-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
            : "border-border bg-secondary",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200",
            value ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </label>
  );
}

function Field({
  label, type = "text", value, onChange, required,
}: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "System Settings — Admin — QEVRIX" },
      { name: "description", content: "Detection thresholds and notification routing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type Settings = {
  system_name: string;
  ai_confidence_threshold: number;
  notify_teacher_missing_id: boolean;
  notify_teacher_unknown: boolean;
  notify_teacher_late_entry: boolean;
  notify_admin_missing_id: boolean;
  notify_admin_unknown: boolean;
  notify_student_verified: boolean;
  notify_student_flagged: boolean;
};

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);

  const q = useQuery({
    queryKey: ["system-settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("system_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as Settings;
    },
  });

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: async (s: Settings) => {
      const { error } = await supabase.from("system_settings").update(s).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!form) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const pct = Math.round(form.ai_confidence_threshold * 100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global configuration that applies to every branch and every role.
        </p>
      </header>

      <section className="card-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">General</h2>
        <div className="mt-4 max-w-md">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">System name</span>
            <input
              value={form.system_name}
              onChange={(e) => setForm({ ...form, system_name: e.target.value })}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
      </section>

      <section className="card-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">AI confidence threshold</h2>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold text-primary">{pct}%</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum recognition confidence required before the system records a detection as verified. Higher values are stricter.
        </p>
        <input
          type="range"
          min={30}
          max={99}
          value={pct}
          onChange={(e) => setForm({ ...form, ai_confidence_threshold: Number(e.target.value) / 100 })}
          className="mt-5 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Permissive · 30%</span>
          <span>Strict · 99%</span>
        </div>
      </section>

      <section className="card-surface p-0">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Notification routing</h2>
          <p className="text-xs text-muted-foreground">Choose which events notify which roles.</p>
        </div>
        <div className="divide-y divide-border">
          <ToggleRow label="ID missing → teachers" desc="Send teachers an alert when a student's ID is not visible." checked={form.notify_teacher_missing_id} onChange={(v) => setForm({ ...form, notify_teacher_missing_id: v })} />
          <ToggleRow label="Unknown person → teachers" desc="Alert teachers when an unrecognised person is detected in their branch." checked={form.notify_teacher_unknown} onChange={(v) => setForm({ ...form, notify_teacher_unknown: v })} />
          <ToggleRow label="Late entry → teachers" desc="Notify teachers about students entering after class hours." checked={form.notify_teacher_late_entry} onChange={(v) => setForm({ ...form, notify_teacher_late_entry: v })} />
          <ToggleRow label="ID missing → admin" desc="Copy admins on missing-ID alerts institution-wide." checked={form.notify_admin_missing_id} onChange={(v) => setForm({ ...form, notify_admin_missing_id: v })} />
          <ToggleRow label="Unknown person → admin" desc="Copy admins on every unknown-person detection." checked={form.notify_admin_unknown} onChange={(v) => setForm({ ...form, notify_admin_unknown: v })} />
          <ToggleRow label="Entry verified → student" desc="Send students a confirmation when their entry is recorded." checked={form.notify_student_verified} onChange={(v) => setForm({ ...form, notify_student_verified: v })} />
          <ToggleRow label="Flagged → student" desc="Let students know when their entry was flagged." checked={form.notify_student_flagged} onChange={(v) => setForm({ ...form, notify_student_flagged: v })} />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button onClick={() => q.data && setForm(q.data)} className="btn-ghost text-sm">Reset</button>
        <button
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

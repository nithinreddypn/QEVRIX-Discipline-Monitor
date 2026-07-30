import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Palette, Sliders as SlidersIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTheme, type Theme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { BackToDashboard } from "@/components/common/BackToDashboard";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [
      { title: "Preferences — QEVRIX" },
      { name: "description", content: "Personalize how QEVRIX looks and behaves." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreferencesPage,
});

type Channels = {
  detections: { in_app: boolean; email: boolean };
  approvals: { in_app: boolean; email: boolean };
  system: { in_app: boolean; email: boolean };
};

const defaultChannels: Channels = {
  detections: { in_app: true, email: false },
  approvals: { in_app: true, email: true },
  system: { in_app: true, email: false },
};

function PreferencesPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const prefs = useQuery({
    queryKey: ["user-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [channels, setChannels] = useState<Channels>(defaultChannels);
  const [landing, setLanding] = useState<string>("");

  useEffect(() => {
    if (prefs.data) {
      const c = (prefs.data.notification_channels as unknown) as Partial<Channels> | null;
      setChannels({ ...defaultChannels, ...(c ?? {}) });
      setLanding(prefs.data.default_landing ?? "");
    }
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: async (patch: {
      theme?: Theme;
      notification_channels?: Channels;
      default_landing?: string;
    }) => {
      if (!user) return;
      const row = {
        user_id: user.id,
        theme: patch.theme ?? theme,
        notification_channels: patch.notification_channels ?? channels,
        default_landing: patch.default_landing ?? landing ?? null,
      };
      const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-prefs"] });
      toast.success("Preferences saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pickTheme(t: Theme) {
    setTheme(t);
    save.mutate({ theme: t });
  }

  function toggleChannel<K extends keyof Channels>(k: K, sub: keyof Channels[K]) {
    const next = { ...channels, [k]: { ...channels[k], [sub]: !channels[k][sub] } };
    setChannels(next);
    save.mutate({ notification_channels: next });
  }

  return (
    <div className="space-y-8">
      <div><BackToDashboard /></div>
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <SlidersIcon className="h-3.5 w-3.5 text-primary" /> App behavior
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize how QEVRIX looks and how you're notified.
        </p>
      </header>

      <section className="card-surface p-6">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold tracking-tight">Theme</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Choose how QEVRIX looks on this device.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(["light", "dark", "system"] as Theme[]).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => pickTheme(t)}
                className={[
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  active ? "border-primary bg-primary/8 text-foreground" : "border-border hover:bg-secondary",
                ].join(" ")}
              >
                <span className="capitalize font-medium">{t}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-surface p-6">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold tracking-tight">Notification channels</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Choose where alerts arrive for each type of event.</p>
        <div className="mt-4 divide-y divide-border">
          {([
            ["detections", "Detections", "New detections and ID card checks"],
            ["approvals", "Approvals", "Signup approvals and status changes"],
            ["system", "System", "Product updates and maintenance"],
          ] as const).map(([k, label, sub]) => (
            <div key={k} className="flex items-center justify-between py-4">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
              <div className="flex gap-2">
                <ChannelChip active={channels[k].in_app} label="In-app" onClick={() => toggleChannel(k, "in_app")} />
                <ChannelChip active={channels[k].email} label="Email" onClick={() => toggleChannel(k, "email")} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChannelChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary",
      ].join(" ")}
    >
      {label} {active ? "on" : "off"}
    </button>
  );
}

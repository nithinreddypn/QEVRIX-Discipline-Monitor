import { CheckCircle2, TriangleAlert, Info, ShieldAlert, BellRing, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type NotifTone = "success" | "warning" | "danger" | "info";

export function classifyNotification(type: string | null | undefined, message?: string): NotifTone {
  const hay = `${type ?? ""} ${message ?? ""}`.toLowerCase();
  if (/unknown|no id|without id|id missing|id not|denied|reject|fail|error|danger/.test(hay)) return "danger";
  if (/flag|missing|warn|alert|late|pending|review/.test(hay)) return "warning";
  if (/verified|approved|success|match|ok|welcome|signed/.test(hay)) return "success";
  return "info";
}

const TONE: Record<NotifTone, {
  ring: string; iconBg: string; iconFg: string; accent: string; chip: string; unreadBg: string; readBg: string; label: string; Icon: typeof CheckCircle2;
}> = {
  success: {
    ring: "ring-emerald-500/20",
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500 to-emerald-400",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
    unreadBg: "bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent",
    readBg: "hover:bg-emerald-500/[0.03]",
    label: "Verified",
    Icon: CheckCircle2,
  },
  warning: {
    ring: "ring-amber-500/20",
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-600 dark:text-amber-400",
    accent: "from-amber-500 to-amber-400",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
    unreadBg: "bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.03] to-transparent",
    readBg: "hover:bg-amber-500/[0.03]",
    label: "Attention",
    Icon: TriangleAlert,
  },
  danger: {
    ring: "ring-rose-500/20",
    iconBg: "bg-rose-500/10",
    iconFg: "text-rose-600 dark:text-rose-400",
    accent: "from-rose-500 to-rose-400",
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20",
    unreadBg: "bg-gradient-to-r from-rose-500/[0.09] via-rose-500/[0.03] to-transparent",
    readBg: "hover:bg-rose-500/[0.03]",
    label: "Alert",
    Icon: ShieldAlert,
  },
  info: {
    ring: "ring-primary/20",
    iconBg: "bg-primary/10",
    iconFg: "text-primary",
    accent: "from-primary to-primary/70",
    chip: "bg-primary/10 text-primary ring-primary/20",
    unreadBg: "bg-gradient-to-r from-primary/[0.07] via-primary/[0.02] to-transparent",
    readBg: "hover:bg-secondary/40",
    label: "Info",
    Icon: Info,
  },
};

export function NotificationItem({
  tone,
  isRead,
  message,
  meta,
  actions,
}: {
  tone: NotifTone;
  isRead: boolean;
  message: ReactNode;
  meta: ReactNode;
  actions?: ReactNode;
}) {
  const t = TONE[tone];
  const Icon = t.Icon;
  return (
    <li
      className={[
        "group relative flex items-start gap-4 px-6 py-4 transition-all duration-200",
        !isRead ? t.unreadBg : t.readBg,
      ].join(" ")}
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className={[
          "absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-gradient-to-b transition-opacity",
          t.accent,
          !isRead ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        ].join(" ")}
      />

      {/* Icon */}
      <span
        className={[
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
          t.iconBg,
          t.ring,
        ].join(" ")}
      >
        <Icon className={["h-5 w-5", t.iconFg].join(" ")} />
        {!isRead && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
          </span>
        )}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
              t.chip,
            ].join(" ")}
          >
            <Sparkles className="h-3 w-3" />
            {t.label}
          </span>
          <span className={["text-sm text-foreground", !isRead ? "font-semibold" : "font-medium"].join(" ")}>
            {message}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
      </div>

      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </li>
  );
}

export function NotificationEmpty({ title = "You're all caught up", sub }: { title?: string; sub?: string }) {
  return (
    <div className="grid place-items-center px-6 py-20 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-2xl" />
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-inset ring-primary/20">
          <BellRing className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{title}</h3>
      {sub && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

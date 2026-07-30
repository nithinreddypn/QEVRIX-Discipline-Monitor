import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  ImageOff,
  ShieldAlert,
  User as UserIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/student/StatusBadge";
import { usePhotoUrl } from "@/lib/photo";

export const Route = createFileRoute("/_authenticated/detections/$id")({
  head: () => ({
    meta: [
      { title: "Detection Details — QEVRIX" },
      { name: "description", content: "Review a captured detection." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetectionDetailsPage,
});

type DetectionRow = {
  id: string;
  detection_time: string;
  image_url: string | null;
  id_card_found: boolean;
  id_card_color: string | null;
  expected_branch_color: string | null;
  color_match: boolean | null;
  status: string | null;
  confidence: number | null;
  student_name: string | null;
  student_id: string | null;
  branch_id: string | null;
  branches: { id: string; code: string; name: string; color_hex: string; color_name: string } | null;
  students: {
    id: string;
    full_name: string;
    usn: string;
    semester: number | null;
    profile_photo_url: string | null;
  } | null;
};

function DetectionDetailsPage() {
  const { id } = Route.useParams();

  const detection = useQuery({
    queryKey: ["detection", id],
    queryFn: async (): Promise<DetectionRow | null> => {
      const { data } = await supabase
        .from("detections")
        .select(
          "id, detection_time, image_url, id_card_found, id_card_color, expected_branch_color, color_match, status, confidence, student_name, student_id, branch_id, branches(id, code, name, color_hex, color_name), students(id, full_name, usn, semester, profile_photo_url)",
        )
        .eq("id", id)
        .maybeSingle();
      return (data as unknown as DetectionRow) ?? null;
    },
  });

  const signedImage = usePhotoUrl(detection.data?.image_url, "esp32-detections");
  const signedProfile = usePhotoUrl(detection.data?.students?.profile_photo_url, "student");

  const notifs = useQuery({
    queryKey: ["detection-notifs", id],
    queryFn: async (): Promise<Set<string>> => {
      const { data: rows } = await supabase
        .from("notifications")
        .select("recipient_user_id")
        .eq("detection_id", id);
      const ids = Array.from(new Set((rows ?? []).map((r) => r.recipient_user_id)));
      if (ids.length === 0) return new Set();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .in("user_id", ids);
      return new Set((roles ?? []).map((r) => r.role as string));
    },
  });

  if (detection.isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading detection…</div>;
  }
  const d = detection.data;
  if (!d) {
    return (
      <div className="card-surface p-10 text-center">
        <h2 className="font-display text-lg font-semibold">Detection not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This record may have been removed, or you don't have access to it.
        </p>
      </div>
    );
  }

  const when = new Date(d.detection_time);
  const roles = notifs.data ?? new Set<string>();
  const confidencePct = d.confidence != null ? Math.round(d.confidence * (d.confidence <= 1 ? 100 : 1)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <StatusBadge status={d.status} />
      </div>

      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Detection details</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {d.student_name ?? (d.id_card_found ? "Unknown person" : "Unidentified — No ID")}
        </h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          {when.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })} ·{" "}
          {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Captured image */}
        <div className="card-surface overflow-hidden p-0">
          <div className="relative aspect-[4/3] w-full bg-secondary">
            {d.image_url && signedImage.data ? (
              <img
                src={signedImage.data}
                alt="Captured frame"
                className="h-full w-full object-cover"
              />
            ) : d.image_url && signedImage.isLoading ? (
              <div className="grid h-full w-full place-items-center text-muted-foreground bg-secondary">
                <div className="text-center animate-pulse">
                  <p className="text-xs">Loading image…</p>
                </div>
              </div>
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <div className="text-center">
                  <ImageOff className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-xs">No image captured</p>
                </div>
              </div>
            )}
            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Student card */}
          <div className="card-surface p-5">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
                {d.students?.profile_photo_url && signedProfile.data ? (
                  <img src={signedProfile.data} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <UserIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {d.students?.full_name ?? d.student_name ?? "Unknown"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {d.students?.usn ?? "—"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.branches ? `${d.branches.code} · ${d.branches.name}` : "Branch — unknown"}
                  {d.students?.semester ? ` · Sem ${d.students.semester}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* AI confidence */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">AI confidence</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {confidencePct != null ? `${confidencePct}%` : "—"}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${confidencePct ?? 0}%` }}
              />
            </div>
          </div>

          {/* Notifications sent */}
          <div className="card-surface p-5">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Who has been alerted about this detection.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["student", "teacher", "admin"] as const).map((r) => (
                <NotifChip key={r} label={r} sent={roles.has(r)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Verification panel */}
      <section className="card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Verification</h2>
          <IdCardChip found={d.id_card_found} />
        </div>

        {d.id_card_found ? (
          <div className="grid gap-6 md:grid-cols-3">
            <ColorBlock
              label="Detected ID color"
              hex={d.id_card_color}
              fallback={d.id_card_found ? "Not analysed" : "No ID card"}
            />
            <ColorBlock
              label="Expected branch color"
              hex={d.expected_branch_color ?? d.branches?.color_hex ?? null}
              fallback="—"
              subLabel={d.branches?.color_name}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Color match
              </p>
              <div className="mt-2">
                {d.color_match === true ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </div>
                ) : d.color_match === false ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <ShieldAlert className="h-4 w-4" /> Mismatch — flagged for review
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border">
                    Not evaluated
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                The detected lanyard color is compared to the branch's official reference color.
              </p>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <ShieldAlert className="h-4 w-4" /> No ID card detected
          </div>
        )}
      </section>

      {d.students?.id && (
        <div className="flex justify-end">
          <Link
            to="/teacher/students/$id"
            params={{ id: d.students.id }}
            className="btn-ghost text-sm"
          >
            View student profile
          </Link>
        </div>
      )}
    </div>
  );
}

function ColorBlock({
  label,
  hex,
  fallback,
  subLabel,
}: {
  label: string;
  hex: string | null | undefined;
  fallback: string;
  subLabel?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg ring-1 ring-inset ring-border"
          style={{ background: hex ?? "transparent" }}
        />
        <div className="min-w-0">
          <p className="font-mono text-sm text-foreground">{hex ?? fallback}</p>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function IdCardChip({ found }: { found: boolean }) {
  return found ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
      <Check className="h-3.5 w-3.5" /> ID card detected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
      <X className="h-3.5 w-3.5" /> ID card not detected
    </span>
  );
}

function NotifChip({ label, sent }: { label: string; sent: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ring-inset",
        sent
          ? "bg-primary/10 text-primary ring-primary/20"
          : "bg-muted text-muted-foreground ring-border",
      ].join(" ")}
    >
      {sent ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

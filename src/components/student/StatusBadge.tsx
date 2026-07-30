export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cfg =
    s === "verified"
      ? { label: "Verified", cls: "bg-primary/10 text-primary ring-primary/20" }
      : s === "flagged"
        ? { label: "Flagged", cls: "bg-amber-100 text-amber-700 ring-amber-200" }
        : s === "pending"
          ? { label: "Pending", cls: "bg-muted text-muted-foreground ring-border" }
          : { label: status ?? "Unknown", cls: "bg-muted text-muted-foreground ring-border" };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        cfg.cls,
      ].join(" ")}
    >
      {cfg.label}
    </span>
  );
}

export function YesNoBadge({ yes }: { yes: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        yes ? "bg-primary/10 text-primary ring-primary/20" : "bg-muted text-muted-foreground ring-border",
      ].join(" ")}
    >
      {yes ? "Yes" : "No"}
    </span>
  );
}

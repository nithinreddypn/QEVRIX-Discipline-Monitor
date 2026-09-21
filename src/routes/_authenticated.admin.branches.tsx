import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Check,
  Clock,
  Coffee,
  Info,
  Moon,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  type BreakTiming,
  type CollegeTimings,
  DEFAULT_COLLEGE_TIMINGS,
  formatTime12h,
  getCollegeTimings,
  getCurrentScheduleStatus,
  saveCollegeTimings,
} from "@/lib/timings";

export const Route = createFileRoute("/_authenticated/admin/branches")({
  head: () => ({
    meta: [
      { title: "Branches & Timings — Admin — QEVRIX" },
      { name: "description", content: "Manage branches, reference ID colors, and college timings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BranchesPage,
});

type Branch = {
  id: string;
  name: string;
  code: string;
  color_name: string;
  color_hex: string;
};

const COLOR_REFS = [
  { name: "Blue", hex: "#3b82f6" },
  { name: "Red", hex: "#ef4444" },
  { name: "Green", hex: "#10b981" },
  { name: "Yellow", hex: "#f59e0b" },
];

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hexToRgb(hex: string) {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  } else if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function getNearestColorName(hex: string): string {
  const target = hexToRgb(hex);
  if (!target) return "";

  let bestName = "";
  let minDistance = Infinity;

  for (const ref of COLOR_REFS) {
    const refRgb = hexToRgb(ref.hex);
    if (!refRgb) continue;
    const distance = Math.sqrt(
      Math.pow(target.r - refRgb.r, 2) +
      Math.pow(target.g - refRgb.g, 2) +
      Math.pow(target.b - refRgb.b, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      bestName = ref.name;
    }
  }

  return bestName;
}

const empty: Omit<Branch, "id"> = { name: "", code: "", color_name: "Green", color_hex: "#10B981" };

function calculateDurationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

function BranchesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [confirmDel, setConfirmDel] = useState<Branch | null>(null);

  // College Timings states
  const [timingsOpen, setTimingsOpen] = useState(false);
  const [timingsForm, setTimingsForm] = useState<CollegeTimings>(DEFAULT_COLLEGE_TIMINGS);

  const branches = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase
        .from("branches")
        .select("id, name, code, color_name, color_hex")
        .order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const timingsQuery = useQuery({
    queryKey: ["college-timings"],
    queryFn: async (): Promise<CollegeTimings> => {
      return await getCollegeTimings();
    },
  });

  useEffect(() => {
    if (timingsQuery.data) {
      setTimingsForm(timingsQuery.data);
    }
  }, [timingsQuery.data]);

  const upsert = useMutation({
    mutationFn: async (payload: Omit<Branch, "id"> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("branches").update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branches"] });
      setEditing(null);
      setCreating(false);
      toast.success("Branch saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branches"] });
      setConfirmDel(null);
      toast.success("Branch deleted");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  const saveTimings = useMutation({
    mutationFn: async (data: CollegeTimings) => {
      return await saveCollegeTimings({ data });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["college-timings"] });
      setTimingsOpen(false);
      toast.success("College timings and schedule updated");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to save timings");
    },
  });

  function openCreate() {
    setForm(empty);
    setCreating(true);
  }

  function openEdit(b: Branch) {
    setForm({ name: b.name, code: b.code, color_name: b.color_name, color_hex: b.color_hex });
    setEditing(b);
  }

  const open = creating || !!editing;
  const currentTimings = timingsQuery.data || DEFAULT_COLLEGE_TIMINGS;
  const scheduleStatus = getCurrentScheduleStatus(currentTimings);

  const toggleDay = (day: string) => {
    setTimingsForm((prev) => {
      const exists = prev.working_days.includes(day);
      const updated = exists
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day];
      return { ...prev, working_days: updated };
    });
  };

  const updateBreak = (index: number, patch: Partial<BreakTiming>) => {
    setTimingsForm((prev) => {
      const updatedBreaks = [...prev.breaks];
      updatedBreaks[index] = { ...updatedBreaks[index], ...patch };
      return { ...prev, breaks: updatedBreaks };
    });
  };

  const addBreak = () => {
    setTimingsForm((prev) => ({
      ...prev,
      breaks: [
        ...prev.breaks,
        {
          id: `break_${Date.now()}`,
          name: "Additional Break",
          start_time: "15:00",
          end_time: "15:20",
          enabled: true,
          allow_movement: true,
        },
      ],
    }));
  };

  const removeBreak = (index: number) => {
    setTimingsForm((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((_, i) => i !== index),
    }));
  };

  const applyPreset = (preset: "standard" | "engineering" | "halfday") => {
    if (preset === "standard") {
      setTimingsForm({
        ...timingsForm,
        college_start: "08:30",
        late_threshold: "09:00",
        college_end: "16:30",
        working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        breaks: [
          { id: "morning_break", name: "Morning Break", start_time: "11:00", end_time: "11:15", enabled: true, allow_movement: true },
          { id: "lunch_break", name: "Lunch Break", start_time: "13:00", end_time: "14:00", enabled: true, allow_movement: true },
          { id: "evening_break", name: "Evening Break", start_time: "15:30", end_time: "15:45", enabled: false, allow_movement: true },
        ],
      });
      toast.info("Applied Standard Schedule (8:30 AM – 4:30 PM)");
    } else if (preset === "engineering") {
      setTimingsForm({
        ...timingsForm,
        college_start: "09:00",
        late_threshold: "09:15",
        college_end: "17:00",
        working_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        breaks: [
          { id: "morning_break", name: "Morning Break", start_time: "11:15", end_time: "11:30", enabled: true, allow_movement: true },
          { id: "lunch_break", name: "Lunch Break", start_time: "13:15", end_time: "14:15", enabled: true, allow_movement: true },
          { id: "evening_break", name: "Evening Break", start_time: "16:00", end_time: "16:15", enabled: true, allow_movement: true },
        ],
      });
      toast.info("Applied Engineering Shift (9:00 AM – 5:00 PM)");
    } else if (preset === "halfday") {
      setTimingsForm({
        ...timingsForm,
        college_start: "08:00",
        late_threshold: "08:20",
        college_end: "13:30",
        working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        breaks: [
          { id: "morning_break", name: "Morning Break", start_time: "10:30", end_time: "11:00", enabled: true, allow_movement: true },
        ],
      });
      toast.info("Applied Morning Shift (8:00 AM – 1:30 PM)");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Branches & Timings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage academic branches, ID verification colors, and campus operating timings.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setTimingsOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 border border-border bg-card text-sm shadow-xs transition hover:bg-secondary"
          >
            <Clock className="h-4 w-4 text-primary" />
            Set College Timings
          </button>
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add branch
          </button>
        </div>
      </header>

      {/* College Timings & Schedule Overview Banner */}
      <section className="card-surface overflow-hidden p-5 border border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                  College Timings & Schedule
                </h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${scheduleStatus.badgeClass}`}>
                  {scheduleStatus.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Active academic operating hours across all departments and gate cameras.
              </p>
            </div>
          </div>
          <button
            onClick={() => setTimingsOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit Schedule & Breaks →
          </button>
        </div>

        {/* Schedule Timeline Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          {/* 1. College Start */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>College Start</span>
            </div>
            <div className="mt-1 font-display text-base font-semibold text-foreground">
              {formatTime12h(currentTimings.college_start)}
            </div>
            <span className="text-[10px] text-muted-foreground">Gates open</span>
          </div>

          {/* 2. Late Entry Cutoff */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Clock className="h-3.5 w-3.5 text-rose-500" />
              <span>Late Cutoff</span>
            </div>
            <div className="mt-1 font-display text-base font-semibold text-foreground">
              {formatTime12h(currentTimings.late_threshold)}
            </div>
            <span className="text-[10px] text-rose-600 font-medium">Late alert triggered</span>
          </div>

          {/* 3. Morning Break */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Coffee className="h-3.5 w-3.5 text-emerald-600" />
              <span>Morning Break</span>
            </div>
            {currentTimings.breaks.find((b) => b.id === "morning_break" && b.enabled) ? (
              <>
                <div className="mt-1 font-display text-sm font-semibold text-foreground truncate">
                  {formatTime12h(currentTimings.breaks.find((b) => b.id === "morning_break")!.start_time)} –{" "}
                  {formatTime12h(currentTimings.breaks.find((b) => b.id === "morning_break")!.end_time)}
                </div>
                <span className="text-[10px] text-emerald-600">Movement allowed</span>
              </>
            ) : (
              <div className="mt-2 text-muted-foreground/60 italic">Disabled</div>
            )}
          </div>

          {/* 4. Lunch Break */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Utensils className="h-3.5 w-3.5 text-orange-500" />
              <span>Lunch Break</span>
            </div>
            {currentTimings.breaks.find((b) => b.id === "lunch_break" && b.enabled) ? (
              <>
                <div className="mt-1 font-display text-sm font-semibold text-foreground truncate">
                  {formatTime12h(currentTimings.breaks.find((b) => b.id === "lunch_break")!.start_time)} –{" "}
                  {formatTime12h(currentTimings.breaks.find((b) => b.id === "lunch_break")!.end_time)}
                </div>
                <span className="text-[10px] text-emerald-600">Movement allowed</span>
              </>
            ) : (
              <div className="mt-2 text-muted-foreground/60 italic">Disabled</div>
            )}
          </div>

          {/* 5. College End */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Moon className="h-3.5 w-3.5 text-indigo-500" />
              <span>College End</span>
            </div>
            <div className="mt-1 font-display text-base font-semibold text-foreground">
              {formatTime12h(currentTimings.college_end)}
            </div>
            <span className="text-[10px] text-muted-foreground">Dismissal / Gate lock</span>
          </div>

          {/* 6. Active Days */}
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Working Days</span>
            </div>
            <div className="mt-1 font-display text-sm font-semibold text-foreground">
              {currentTimings.working_days.length === 5 && !currentTimings.working_days.includes("Sat")
                ? "Mon – Fri"
                : currentTimings.working_days.join(", ")}
            </div>
            <span className="text-[10px] text-muted-foreground">{currentTimings.working_days.length} days / week</span>
          </div>
        </div>
      </section>

      {/* Branches Table Section */}
      <div className="card-surface overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">Code</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Reference ID color</th>
              <th className="px-6 py-3">Schedule</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {(branches.data ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-secondary/30">
                <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs font-medium text-foreground">{b.code}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-foreground font-medium">{b.name}</td>
                <td className="whitespace-nowrap px-6 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-6 w-6 rounded-md ring-1 ring-inset ring-border"
                      style={{ backgroundColor: b.color_hex }}
                    />
                    <span className="text-muted-foreground">{b.color_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground/70">{b.color_hex}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-3.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
                    <Clock className="h-3 w-3 text-primary" />
                    {formatTime12h(currentTimings.college_start)} – {formatTime12h(currentTimings.college_end)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-3.5 text-right">
                  <button onClick={() => openEdit(b)} className="mr-2 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Edit branch">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDel(b)} className="rounded p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-700" title="Delete branch">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(branches.data ?? []).length === 0 && !branches.isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No branches yet. Add your first branch to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* College Timings Modal Dialog */}
      <Dialog open={timingsOpen} onOpenChange={setTimingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <DialogTitle>College Timings & Schedule</DialogTitle>
            </div>
            <DialogDescription>
              Set campus start time, late arrival grace cutoffs, and designated student break windows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Presets Row */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => applyPreset("standard")}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Standard (8:30 – 4:30)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("engineering")}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Engineering Shift (9:00 – 5:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("halfday")}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Morning Shift (8:00 – 1:30)
              </button>
            </div>

            {/* 1. Daily College Hours */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-primary" /> Daily Campus Hours
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="College Start Time">
                  <input
                    type="time"
                    value={timingsForm.college_start}
                    onChange={(e) => setTimingsForm({ ...timingsForm, college_start: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Campus gates open</span>
                </Field>

                <Field label="Late Entry Cutoff">
                  <input
                    type="time"
                    value={timingsForm.late_threshold}
                    onChange={(e) => setTimingsForm({ ...timingsForm, late_threshold: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <span className="text-[10px] text-rose-600 mt-1 block font-medium">Late alert triggered after this</span>
                </Field>

                <Field label="College End Time">
                  <input
                    type="time"
                    value={timingsForm.college_end}
                    onChange={(e) => setTimingsForm({ ...timingsForm, college_end: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Dismissal / Gates locked</span>
                </Field>
              </div>
            </div>

            {/* 2. Breaks & Recess */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-primary" /> Breaks & Recess Windows
                </h3>
                <button
                  type="button"
                  onClick={addBreak}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Break
                </button>
              </div>

              <div className="space-y-2.5">
                {timingsForm.breaks.map((b, idx) => {
                  const duration = calculateDurationMinutes(b.start_time, b.end_time);
                  return (
                    <div
                      key={b.id || idx}
                      className={`rounded-lg border p-3 transition ${
                        b.enabled ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-65"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={b.enabled}
                            onCheckedChange={(val) => updateBreak(idx, { enabled: val })}
                          />
                          <input
                            type="text"
                            value={b.name}
                            onChange={(e) => updateBreak(idx, { name: e.target.value })}
                            className="text-xs font-semibold bg-transparent border-none p-0 focus:outline-none focus:underline"
                            placeholder="Break Name"
                          />
                          {b.enabled && duration > 0 && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {duration} mins
                            </span>
                          )}
                        </div>

                        {idx > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBreak(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                            title="Remove break"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {b.enabled && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                          <div>
                            <span className="text-[11px] text-muted-foreground block mb-1">Start Time</span>
                            <input
                              type="time"
                              value={b.start_time}
                              onChange={(e) => updateBreak(idx, { start_time: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground block mb-1">End Time</span>
                            <input
                              type="time"
                              value={b.end_time}
                              onChange={(e) => updateBreak(idx, { end_time: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Working Days */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Working Days
              </h3>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const isSelected = timingsForm.working_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Discipline & Movement Policies */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/15 p-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" /> Disciplinary Gate Rules
              </h3>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-foreground">Allow Gate Movement During Breaks</div>
                  <div className="text-[11px] text-muted-foreground">
                    Students can cross campus gates during designated recess/lunch windows without violation warnings.
                  </div>
                </div>
                <Switch
                  checked={timingsForm.allow_break_movement}
                  onCheckedChange={(val) => setTimingsForm({ ...timingsForm, allow_break_movement: val })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/50">
                <div>
                  <div className="text-xs font-medium text-foreground">Flag Entries During Active Class Hours</div>
                  <div className="text-[11px] text-muted-foreground">
                    Sightings between cutoff and break intervals are flagged for teacher review.
                  </div>
                </div>
                <Switch
                  checked={timingsForm.flag_lecture_hours}
                  onCheckedChange={(val) => setTimingsForm({ ...timingsForm, flag_lecture_hours: val })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => setTimingsOpen(false)}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveTimings.mutate(timingsForm)}
              disabled={saveTimings.isPending}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saveTimings.isPending ? "Saving Timings…" : "Save College Timings"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit branch" : "Add branch"}</DialogTitle>
            <DialogDescription>
              This color is the reference used to verify ID cards for this branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code">
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputCls} placeholder="ISE" />
              </Field>
              <Field label="Name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Information Science and Engineering" />
              </Field>
            </div>
            <div>
              <Field label="Reference ID color">
                <div className="flex items-center gap-3">
                  <label className="relative inline-block h-10 w-14 cursor-pointer overflow-hidden rounded-md ring-1 ring-inset ring-border" style={{ backgroundColor: form.color_hex }}>
                    <input
                      type="color"
                      value={form.color_hex}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setForm({ ...form, color_hex: hex, color_name: getNearestColorName(hex) });
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <input value={form.color_name} onChange={(e) => setForm({ ...form, color_name: e.target.value })} className={inputCls + " flex-1"} placeholder="Green" />
                  <input
                    value={form.color_hex}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setForm({ ...form, color_hex: hex, color_name: getNearestColorName(hex) });
                    }}
                    className={inputCls + " w-28 font-mono text-xs"}
                    placeholder="#22C55E"
                  />
                </div>
              </Field>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is the reference color used to verify ID cards for this branch. The detection pipeline compares the physical lanyard/card against this value.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Branch Operating Schedule:
              </span>
              <p className="mt-1 text-muted-foreground text-[11px]">
                Inherits institution-wide College Timings ({formatTime12h(currentTimings.college_start)} – {formatTime12h(currentTimings.college_end)}). Configure global schedule using the "Set College Timings" button.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={() => upsert.mutate(editing ? { ...form, id: editing.id } : form)}
              disabled={upsert.isPending || !form.code || !form.name}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete branch?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{confirmDel?.name}</strong>. Students and teachers assigned to it will lose their branch link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setConfirmDel(null)} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={() => confirmDel && del.mutate(confirmDel.id)}
              disabled={del.isPending}
              className="inline-flex h-9 items-center rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

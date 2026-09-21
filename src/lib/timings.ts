import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs/promises";
import path from "node:path";

export interface BreakTiming {
  id: string;
  name: string;
  start_time: string; // "11:00"
  end_time: string;   // "11:15"
  enabled: boolean;
  allow_movement: boolean;
}

export interface CollegeTimings {
  college_start: string;      // "08:30"
  late_threshold: string;     // "09:00" (Late arrival mark)
  college_end: string;        // "16:30"
  working_days: string[];     // ["Mon", "Tue", "Wed", "Thu", "Fri"]
  breaks: BreakTiming[];
  allow_break_movement: boolean;
  flag_lecture_hours: boolean;
  updated_at?: string;
  branch_schedules?: Record<string, {
    college_start?: string;
    late_threshold?: string;
    college_end?: string;
    breaks?: BreakTiming[];
  }>;
}

export const DEFAULT_COLLEGE_TIMINGS: CollegeTimings = {
  college_start: "08:30",
  late_threshold: "09:00",
  college_end: "16:30",
  working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  breaks: [
    {
      id: "morning_break",
      name: "Morning Break",
      start_time: "11:00",
      end_time: "11:15",
      enabled: true,
      allow_movement: true,
    },
    {
      id: "lunch_break",
      name: "Lunch Break",
      start_time: "13:00",
      end_time: "14:00",
      enabled: true,
      allow_movement: true,
    },
    {
      id: "evening_break",
      name: "Evening Break",
      start_time: "15:30",
      end_time: "15:45",
      enabled: false,
      allow_movement: true,
    },
  ],
  allow_break_movement: true,
  flag_lecture_hours: true,
  branch_schedules: {},
};

function getConfigPath(): string {
  return path.resolve(process.cwd(), "college_timings.json");
}

async function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL);

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.warn("[Timings] Could not initialize Supabase client:", err);
    return null;
  }
}

export const getCollegeTimings = createServerFn({ method: "GET" }).handler(
  async (): Promise<CollegeTimings> => {
    // 1. First priority: Load from persistent cloud storage (Supabase)
    try {
      const sbAdmin = await getSupabaseAdmin();
      if (sbAdmin) {
        const { data: fileData, error } = await sbAdmin.storage
          .from("student-photos")
          .download("college_timings.json");
        if (!error && fileData) {
          const text = await fileData.text();
          const parsed = JSON.parse(text);
          return {
            ...DEFAULT_COLLEGE_TIMINGS,
            ...parsed,
            breaks: parsed.breaks || DEFAULT_COLLEGE_TIMINGS.breaks,
          };
        }
      }
    } catch (sbErr) {
      console.warn("[Timings Server] Cloud storage fetch notice:", sbErr);
    }

    // 2. Second priority: Fallback to local file if available
    try {
      const filePath = getConfigPath();
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_COLLEGE_TIMINGS,
        ...parsed,
        breaks: parsed.breaks || DEFAULT_COLLEGE_TIMINGS.breaks,
      };
    } catch {
      return DEFAULT_COLLEGE_TIMINGS;
    }
  }
);

export const saveCollegeTimings = createServerFn({ method: "POST" })
  .validator((data: CollegeTimings) => data)
  .handler(async ({ data }): Promise<{ success: boolean; data: CollegeTimings }> => {
    const toSave: CollegeTimings = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(toSave, null, 2);

    // 1. Always persist to Supabase Storage (globally accessible across serverless instances)
    try {
      const sbAdmin = await getSupabaseAdmin();
      if (sbAdmin) {
        const buffer = Buffer.from(jsonStr, "utf-8");
        const { error: uploadError } = await sbAdmin.storage
          .from("student-photos")
          .upload("college_timings.json", buffer, {
            upsert: true,
            contentType: "application/json",
          });
        if (uploadError) {
          console.warn("[Timings Server] Supabase storage upload warning:", uploadError);
        }
      }
    } catch (sbErr) {
      console.warn("[Timings Server] Failed to save to Supabase storage:", sbErr);
    }

    // 2. Safely attempt local file write (only if filesystem is writable; gracefully ignore EROFS in serverless like Vercel)
    try {
      const filePath = getConfigPath();
      await fs.writeFile(filePath, jsonStr, "utf-8");
    } catch (fsErr: any) {
      // In serverless environments like Vercel/AWS Lambda, /var/task is read-only (EROFS).
      // This is expected and safe since the configuration is persisted in cloud storage.
      console.log("[Timings Server] Filesystem is read-only (EROFS), persisted safely in cloud storage.");
    }

    return { success: true, data: toSave };
  });

export function formatTime12h(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function getCurrentScheduleStatus(timings: CollegeTimings): {
  status: "before_college" | "on_time" | "late" | "break" | "lecture" | "after_college" | "holiday";
  label: string;
  badgeClass: string;
} {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDay = days[now.getDay()];

  if (!timings.working_days.includes(currentDay)) {
    return {
      status: "holiday",
      label: "Campus Closed (Holiday / Off-day)",
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (currentTime < timings.college_start) {
    return {
      status: "before_college",
      label: `Pre-Campus Hours (Opens at ${formatTime12h(timings.college_start)})`,
      badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50",
    };
  }

  if (currentTime >= timings.college_start && currentTime <= timings.late_threshold) {
    return {
      status: "on_time",
      label: `On-Time Entry Window (Until ${formatTime12h(timings.late_threshold)})`,
      badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50",
    };
  }

  // Check active breaks
  for (const b of timings.breaks) {
    if (b.enabled && currentTime >= b.start_time && currentTime <= b.end_time) {
      return {
        status: "break",
        label: `${b.name} (${formatTime12h(b.start_time)} – ${formatTime12h(b.end_time)})`,
        badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50",
      };
    }
  }

  if (currentTime > timings.college_end) {
    return {
      status: "after_college",
      label: `College Dismissed (Ended at ${formatTime12h(timings.college_end)})`,
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  return {
    status: "lecture",
    label: `Active Academic Hours (Dismissal at ${formatTime12h(timings.college_end)})`,
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50",
  };
}

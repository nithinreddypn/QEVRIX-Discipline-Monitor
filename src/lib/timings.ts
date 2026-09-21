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

export const getCollegeTimings = createServerFn({ method: "GET" }).handler(
  async (): Promise<CollegeTimings> => {
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
    try {
      const filePath = getConfigPath();
      const toSave: CollegeTimings = {
        ...data,
        updated_at: new Date().toISOString(),
      };
      await fs.writeFile(filePath, JSON.stringify(toSave, null, 2), "utf-8");
      return { success: true, data: toSave };
    } catch (err: any) {
      console.error("[Timings Server] Failed to save college timings:", err);
      throw new Error("Failed to save college timings: " + (err.message || "Unknown error"));
    }
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
      label: "Non-Working Day",
      badgeClass: "bg-muted text-muted-foreground",
    };
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (currentTime < timings.college_start) {
    return {
      status: "before_college",
      label: "Gates Opening Soon",
      badgeClass: "bg-blue-100 text-blue-700",
    };
  }

  if (currentTime >= timings.college_start && currentTime <= timings.late_threshold) {
    return {
      status: "on_time",
      label: "On-Time Entry Window",
      badgeClass: "bg-emerald-100 text-emerald-700",
    };
  }

  if (currentTime > timings.college_end) {
    return {
      status: "after_college",
      label: "College Closed / Gates Locked",
      badgeClass: "bg-slate-100 text-slate-700",
    };
  }

  // Check active break
  const activeBreak = timings.breaks.find(
    (b) => b.enabled && currentTime >= b.start_time && currentTime <= b.end_time
  );

  if (activeBreak) {
    return {
      status: "break",
      label: `${activeBreak.name} (Movement Allowed)`,
      badgeClass: "bg-amber-100 text-amber-700",
    };
  }

  return {
    status: "lecture",
    label: "Active Academic Hours (Late Entry Flagged)",
    badgeClass: "bg-purple-100 text-purple-700",
  };
}

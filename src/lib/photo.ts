import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Accepts either a stored path (e.g. `${uid}/profile.jpg`) or a legacy
 * Supabase URL that contains `/student-photos/<path>`, and returns a fresh
 * signed URL. Bucket is private, so signed URLs are required for display.
 */
export function usePhotoUrl(stored: string | null | undefined, type: "student" | "teacher" | "esp32-detections" = "student") {
  return useQuery({
    queryKey: ["signed-photo", stored ?? null, type],
    enabled: !!stored,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!stored) return null;
      let path = stored;
      
      // Auto-detect bucket from stored path if it contains bucket name prefix
      let bucket: "student-photos" | "teacher-photos" | "esp32-detections" = "student-photos";
      if (type === "teacher") bucket = "teacher-photos";
      else if (type === "esp32-detections") bucket = "esp32-detections";

      if (stored.includes("teacher-photos/")) {
        bucket = "teacher-photos";
      } else if (stored.includes("student-photos/")) {
        bucket = "student-photos";
      } else if (stored.includes("esp32-detections/")) {
        bucket = "esp32-detections";
      }

      // Strip legacy Supabase URLs or direct path matching
      const m = stored.match(/(?:student-photos|teacher-photos|esp32-detections)\/(.+?)(\?|$)/);
      if (m) path = m[1];

      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });
}

export function extractPhotoPath(uid: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  return `${uid}/profile.${ext}`;
}

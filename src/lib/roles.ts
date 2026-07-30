import type { AppRole } from "@/lib/auth-context";

export function roleHome(role: AppRole | undefined): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return "/teacher/dashboard";
    case "student":
    default:
      return "/student/dashboard";
  }
}

export async function fetchPrimaryRole(userId: string): Promise<AppRole> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  // Priority: admin > teacher > student
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return "teacher";
  return "student";
}

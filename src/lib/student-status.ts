import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type StudentStatus = "pending_approval" | "active" | "rejected";

export type StudentRecord = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  status: StudentStatus;
  rejection_reason: string | null;
  branch_id: string | null;
  branch?: { name: string | null; code: string | null } | null;
};

export function useStudentRecord() {
  const { user, roles } = useAuth();
  const isStudent = roles.includes("student") && !roles.includes("teacher") && !roles.includes("admin");
  return useQuery({
    queryKey: ["student-self", user?.id],
    enabled: !!user && isStudent,
    queryFn: async (): Promise<StudentRecord | null> => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, usn, semester, phone, email, profile_photo_url, status, rejection_reason, branch_id, branch:branches(name, code)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as unknown as StudentRecord | null) ?? null;
    },
  });
}

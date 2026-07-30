import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/common/ProfilePhoto";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/teacher/students/")({
  head: () => ({
    meta: [
      { title: "Students — Teacher — QEVRIX" },
      { name: "description", content: "Students in your branch." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherStudentsPage,
});

type Student = {
  id: string;
  full_name: string;
  usn: string;
  semester: number | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
};

function useTypewriterPlaceholder(placeholders: string[], speed = 80, delay = 1500) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const full = placeholders[index];

    if (isDeleting) {
      timer = setTimeout(() => {
        setText(full.substring(0, text.length - 1));
      }, speed / 2);
    } else {
      timer = setTimeout(() => {
        setText(full.substring(0, text.length + 1));
      }, speed);
    }

    if (!isDeleting && text === full) {
      timer = setTimeout(() => setIsDeleting(true), delay);
    } else if (isDeleting && text === "") {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % placeholders.length);
    }

    return () => clearTimeout(timer);
  }, [text, isDeleting, index, placeholders, speed, delay]);

  return text;
}

function TeacherStudentsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const typewriterText = useTypewriterPlaceholder([
    "Search by student name...",
    "Search by USN (e.g. 1GA)...",
    "Search by email address..."
  ]);

  const students = useQuery({
    queryKey: ["teacher-students", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Student[]> => {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("branch_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      const query = supabase
        .from("students")
        .select("id, full_name, usn, semester, email, phone, profile_photo_url");

      if (teacher?.branch_id) {
        query.eq("branch_id", teacher.branch_id);
      }

      const { data } = await query.order("full_name", { ascending: true });
      return (data as Student[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = students.data ?? [];
    if (!term) return list;
    return list.filter(
      (s) =>
        s.full_name.toLowerCase().includes(term) ||
        s.usn.toLowerCase().includes(term) ||
        (s.email ?? "").toLowerCase().includes(term),
    );
  }, [q, students.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.data ? `${students.data.length} student${students.data.length === 1 ? "" : "s"} in your branch` : "Loading branch roster…"}
          </p>
        </div>
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={typewriterText}
            className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      <div className="card-surface overflow-hidden p-0">
        {students.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
              {q ? "No matches" : "No students yet"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {q ? "Try a different name or USN." : "Students in your branch will appear here once added."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">USN</th>
                  <th className="px-6 py-3">Semester</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <ProfilePhoto
                          src={s.profile_photo_url}
                          className="h-8 w-8"
                          iconSizeClassName="h-4 w-4"
                        />
                        <span className="font-medium text-foreground">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-muted-foreground">{s.usn}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{s.semester ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{s.email ?? s.phone ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right">
                      <Link
                        to="/teacher/students/$id"
                        params={{ id: s.id }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

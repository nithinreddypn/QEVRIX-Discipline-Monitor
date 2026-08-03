import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentDisabledPage,
});

function StudentDisabledPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function performSignOut() {
      toast.error("Student portal is disabled.");
      await signOut();
      navigate({ to: "/login", replace: true });
    }
    performSignOut();
  }, [signOut, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="text-sm text-muted-foreground">Student portal is disabled. Redirecting…</div>
    </div>
  );
}

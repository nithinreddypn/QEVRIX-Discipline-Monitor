import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/common/RoleGate";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <RoleGate allow="admin" />,
});

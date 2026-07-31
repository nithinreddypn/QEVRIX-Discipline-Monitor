import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/branches")({
  head: () => ({
    meta: [
      { title: "Branches — Admin — QEVRIX" },
      { name: "description", content: "Manage branches and reference ID colors." },
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

function BranchesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [confirmDel, setConfirmDel] = useState<Branch | null>(null);

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

  function openCreate() {
    setForm(empty);
    setCreating(true);
  }
  function openEdit(b: Branch) {
    setForm({ name: b.name, code: b.code, color_name: b.color_name, color_hex: b.color_hex });
    setEditing(b);
  }

  const open = creating || !!editing;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each branch has an official ID-card color used to verify students at entry.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add branch
        </button>
      </header>

      <div className="card-surface overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">Code</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Reference ID color</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {(branches.data ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-secondary/30">
                <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs font-medium text-foreground">{b.code}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-foreground">{b.name}</td>
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
                <td className="whitespace-nowrap px-6 py-3.5 text-right">
                  <button onClick={() => openEdit(b)} className="mr-2 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDel(b)} className="rounded p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(branches.data ?? []).length === 0 && !branches.isLoading && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No branches yet. Add your first branch to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

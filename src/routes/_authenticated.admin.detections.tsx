import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Download,
  Search,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  X,
  RefreshCw,
  Eye,
  UserCheck,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";
import { usePhotoUrl } from "@/lib/photo";

export const Route = createFileRoute("/_authenticated/admin/detections")({
  head: () => ({
    meta: [
      { title: "Detection History — Admin — QEVRIX" },
      { name: "description", content: "System-wide detection history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetectionsPage,
});

type Branch = { id: string; code: string; name: string };
type Row = {
  id: string;
  detection_time: string;
  id_card_found: boolean;
  status: string | null;
  student_name: string | null;
  branch_id: string | null;
  branches: { code: string | null; name: string | null } | null;
  students: { usn: string | null } | null;
  is_repeat: boolean | null;
  repeat_count: number | null;
  image_url: string | null;
};

function DetectionThumbnail({
  imageUrl,
  studentName,
  onEnlarge,
}: {
  imageUrl?: string | null;
  studentName?: string | null;
  onEnlarge?: (url: string) => void;
}) {
  const signed = usePhotoUrl(imageUrl, "esp32-detections");

  if (!imageUrl) {
    return (
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/80 text-muted-foreground/50 border border-border">
        <Camera className="h-4 w-4" />
      </div>
    );
  }

  if (signed.isLoading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary/80 border border-border flex items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signed.data) {
    return (
      <div
        className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/80 text-muted-foreground/50 border border-border"
        title="Photo unavailable"
      >
        <Camera className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onEnlarge && signed.data) {
          onEnlarge(signed.data);
        }
      }}
      className="relative group/thumb h-11 w-11 overflow-hidden rounded-lg border border-border bg-black/10 shrink-0 transition hover:ring-2 hover:ring-primary/60 focus:outline-none"
      title="Click to view full photo"
    >
      <img
        src={signed.data}
        alt={studentName ?? "Detection frame"}
        className="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Eye className="h-4 w-4 drop-shadow" />
      </div>
    </button>
  );
}

const STATUSES = ["all", "verified", "flagged", "pending", "unknown"] as const;

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

function DetectionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const typewriterText = useTypewriterPlaceholder([
    "Search by student name...",
    "Search by USN (e.g. 1GA)...",
    "Filter by detection keyword..."
  ]);
  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [idFound, setIdFound] = useState<"all" | "yes" | "no">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const hasActiveFilters = Boolean(
    q.trim() !== "" ||
    branchId !== "all" ||
    status !== "all" ||
    idFound !== "all" ||
    from !== "" ||
    to !== ""
  );

  const resetFilters = () => {
    setQ("");
    setBranchId("all");
    setStatus("all");
    setIdFound("all");
    setFrom("");
    setTo("");
  };

  // Test Modal states
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Photo Preview Modal state
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    studentName: string;
    time: string;
    status: string;
    id: string;
  } | null>(null);

  // Sync bucket state
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncBucket() {
    setIsSyncing(true);
    try {
      // 1. Scan esp32-detections storage bucket
      const { data: files, error: listError } = await supabase.storage
        .from("esp32-detections")
        .list("", { limit: 100, sortBy: { column: "name", order: "desc" } });

      if (listError) {
        throw new Error(`Storage query failed: ${listError.message}`);
      }

      const validFiles = (files || []).filter(
        (f) => f.name && !f.name.startsWith(".") && (f.name.endsWith(".jpg") || f.name.endsWith(".jpeg") || f.name.endsWith(".png"))
      );

      if (validFiles.length === 0) {
        toast.info("No images found in esp32-detections storage bucket.");
        return;
      }

      // 2. Fetch already queued paths
      const { data: qData } = await (supabase.from as any)("processing_queue").select("image_path");
      const queuedPaths = new Set((qData || []).map((q: any) => q.image_path));

      // 3. Queue unqueued files
      const toQueue = validFiles
        .filter((f) => !queuedPaths.has(f.name))
        .map((f) => ({
          image_path: f.name,
          status: "queued",
          retry_count: 0,
        }));

      if (toQueue.length > 0) {
        const { error: insertErr } = await (supabase.from as any)("processing_queue").insert(toQueue);
        if (insertErr) {
          throw new Error(`Queue insert failed: ${insertErr.message}`);
        }
        toast.success(`Queued ${toQueue.length} new camera frame(s) for AI processing.`);
      } else {
        toast.info(`All ${validFiles.length} storage images are queued or processed.`);
      }

      // Invalidate detection list query to pull latest processed rows
      qc.invalidateQueries({ queryKey: ["admin-detections"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to sync camera bucket.");
    } finally {
      setIsSyncing(false);
    }
  }

  const branches = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async (): Promise<Branch[]> => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return (data as Branch[] | null) ?? [];
    },
  });

  const rows = useQuery({
    queryKey: ["admin-detections"],
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("detections")
        .select("id, detection_time, id_card_found, status, student_name, branch_id, branches(code, name), students(usn), is_repeat, repeat_count, image_url")
        .order("detection_time", { ascending: false })
        .limit(2000);
      return (data as unknown as Row[] | null) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null;
    return (rows.data ?? []).filter((r) => {
      const t = new Date(r.detection_time).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (branchId !== "all" && r.branch_id !== branchId) return false;
      if (status !== "all" && (r.status ?? "unknown").toLowerCase() !== status) return false;
      if (idFound === "yes" && !r.id_card_found) return false;
      if (idFound === "no" && r.id_card_found) return false;
      if (term) {
        const n = (r.student_name ?? "").toLowerCase();
        const u = (r.students?.usn ?? "").toLowerCase();
        const b = (r.branches?.code ?? "").toLowerCase();
        if (!n.includes(term) && !u.includes(term) && !b.includes(term)) return false;
      }
      return true;
    });
  }, [rows.data, q, branchId, status, idFound, from, to]);

  function exportCsv() {
    const header = ["date", "time", "student", "usn", "branch", "id_found", "status"];
    const csv = [header.join(",")]
      .concat(
        filtered.map((r) => {
          const d = new Date(r.detection_time);
          return [
            d.toISOString().slice(0, 10),
            d.toTimeString().slice(0, 5),
            escapeCsv(r.student_name ?? "Unknown"),
            escapeCsv(r.students?.usn ?? ""),
            escapeCsv(r.branches?.code ?? ""),
            r.id_card_found ? "yes" : "no",
            escapeCsv(r.status ?? "unknown"),
          ].join(",");
        }),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPEG or PNG).");
      return;
    }
    setSelectedFile(file);
    setAnalysisResult(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function handleRunAnalysis() {
    if (!selectedFile) {
      toast.error("Please choose an image to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisStep("Uploading camera frame to campus storage...");

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `web_test_${Date.now()}_${safeName}`;

    try {
      // 1. Upload to esp32-detections storage bucket
      const { error: uploadError } = await supabase.storage
        .from("esp32-detections")
        .upload(storagePath, selectedFile, {
          upsert: true,
          contentType: selectedFile.type || "image/jpeg",
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      setAnalysisStep("AI Pipeline processing (YOLO Person Detector + ResNet Face Match + Lanyard Check)...");

      // 2. Poll Supabase for the completed detection or queue completion
      const fullImageUrl = `esp32-detections/${storagePath}`;
      let attempts = 0;
      const maxAttempts = 20; // 20 * 1.5s = 30 seconds max
      let foundDetection: any = null;
      let queueStatus = "";

      while (attempts < maxAttempts) {
        await new Promise((res) => setTimeout(res, 1500));
        attempts++;

        // Check detections table
        const { data: detData } = await supabase
          .from("detections")
          .select("*, branches(code, name, color_name, color_hex), students(usn, full_name)")
          .eq("image_url", fullImageUrl)
          .maybeSingle();

        if (detData) {
          foundDetection = detData;
          break;
        }

        // Check processing_queue table
        const { data: qData }: { data: any } = await (supabase.from as any)("processing_queue")
          .select("status, retry_count")
          .eq("image_path", storagePath)
          .maybeSingle();

        if (qData) {
          queueStatus = qData.status;
          if (qData.status === "processing") {
            setAnalysisStep("Running ResNet-18 facial embedding & color analysis...");
          } else if (qData.status === "done" && !detData) {
            // Queue finished but no detection row -> Empty frame!
            foundDetection = { emptyFrame: true };
            break;
          } else if (qData.status === "failed") {
            throw new Error("Worker encountered an error while analyzing this frame.");
          }
        }
      }

      if (foundDetection) {
        setAnalysisResult(foundDetection);
        qc.invalidateQueries({ queryKey: ["admin-detections"] });
        if (foundDetection.emptyFrame) {
          toast.info("AI Analysis Complete: Empty frame discarded (no person detected).");
        } else {
          toast.success(`AI Detection Logged: ${foundDetection.student_name || "Unknown Person"} (${foundDetection.status})`);
        }
      } else {
        toast.warning("Analysis is taking longer than usual. The worker will complete it shortly.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process image.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Detection History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every detection captured across the institution.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncBucket}
            disabled={isSyncing}
            className="btn-ghost text-sm inline-flex items-center gap-1.5 border border-border hover:bg-secondary disabled:opacity-50"
            title="Scan esp32-detections bucket and queue any unprocessed uploads"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            {isSyncing ? "Syncing Bucket…" : "Sync Camera Bucket"}
          </button>
          <button
            onClick={() => {
              setSelectedFile(null);
              setPreviewUrl(null);
              setAnalysisResult(null);
              setTestModalOpen(true);
            }}
            className="btn-primary text-sm inline-flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" /> Test AI Detection
          </button>
          <button onClick={exportCsv} className="btn-ghost text-sm">
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </button>
        </div>
      </header>

      <div className="card-surface p-4 space-y-3">
        {/* Primary Filter Row: Search & Key Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-300 group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typewriterText}
              className="w-full rounded-lg border border-input bg-background/60 py-2 pl-9 pr-8 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={`${selectCls} min-w-[140px]`}
          >
            <option value="all">All Branches</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className={`${selectCls} min-w-[130px]`}
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="flagged">Flagged</option>
            <option value="pending">Pending</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            value={idFound}
            onChange={(e) => setIdFound(e.target.value as any)}
            className={`${selectCls} min-w-[125px]`}
          >
            <option value="all">All ID Badges</option>
            <option value="yes">ID Worn</option>
            <option value="no">ID Missing</option>
          </select>
        </div>

        {/* Secondary Filter Row: Date Range & Active Filters Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
              <Calendar className="h-3.5 w-3.5" /> Date Range:
            </span>
            <div className="inline-flex items-center gap-2 rounded-lg border border-input bg-background/60 px-2.5 py-1.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">From:</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
                />
              </div>
              <span className="text-muted-foreground/60">—</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">To:</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
                />
              </div>
              {(from || to) && (
                <button
                  type="button"
                  onClick={() => { setFrom(""); setTo(""); }}
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground transition"
                  title="Clear dates"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick date presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setFrom(today);
                  setTo(today);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition border ${
                  from && to && from === to && from === new Date().toISOString().slice(0, 10)
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setFrom(d.toISOString().slice(0, 10));
                  setTo(new Date().toISOString().slice(0, 10));
                }}
                className="rounded-md px-2.5 py-1 text-xs bg-secondary/60 text-muted-foreground border border-border hover:text-foreground hover:bg-secondary transition"
              >
                Past 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setFrom(d.toISOString().slice(0, 10));
                  setTo(new Date().toISOString().slice(0, 10));
                }}
                className="rounded-md px-2.5 py-1 text-xs bg-secondary/60 text-muted-foreground border border-border hover:text-foreground hover:bg-secondary transition"
              >
                Past 30 Days
              </button>
            </div>
          </div>

          {/* Reset all filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition font-medium hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Reset all filters
            </button>
          )}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        {rows.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading detections…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No detection records match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Photo</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">USN</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">ID Card</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filtered.map((r) => {
                  const d = new Date(r.detection_time);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: "/detections/$id", params: { id: r.id } })}
                      className="cursor-pointer hover:bg-secondary/30 transition-colors group/row"
                    >
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <DetectionThumbnail
                          imageUrl={r.image_url}
                          studentName={r.student_name}
                          onEnlarge={(url) =>
                            setPreviewModal({
                              url,
                              studentName: r.student_name ?? "Unidentified Person",
                              time: `${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                              status: r.status ?? "unknown",
                              id: r.id,
                            })
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                        {d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-foreground flex items-center gap-2">
                        <span className="font-semibold">{r.student_name ?? "Unknown"}</span>
                        {r.is_repeat && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            Repeat ({r.repeat_count})
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">{r.students?.usn ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{r.branches?.code ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3"><YesNoBadge yes={r.id_card_found} /></td>
                      <td className="whitespace-nowrap px-5 py-3"><StatusBadge status={r.status} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({ to: "/detections/$id", params: { id: r.id } });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary/10"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {rows.data?.length ?? 0} records.</p>

      {/* Captured Image Quick-View Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{previewModal.studentName}</h3>
                  <p className="text-xs text-muted-foreground">{previewModal.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={previewModal.status} />
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative rounded-xl border border-border overflow-hidden bg-black/95 flex items-center justify-center min-h-[280px] max-h-[480px]">
              <img
                src={previewModal.url}
                alt="Captured frame"
                className="w-full h-auto max-h-[480px] object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewModal.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline"
              >
                Open full image in new tab ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  const id = previewModal.id;
                  setPreviewModal(null);
                  navigate({ to: "/detections/$id", params: { id } });
                }}
                className="btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5"
              >
                View Full Detection Report →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test AI Detection Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Test AI Image Processing</h2>
                  <p className="text-xs text-muted-foreground">Upload a campus frame to evaluate YOLO body detection, face recognition & lanyard verification.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isAnalyzing) {
                    setTestModalOpen(false);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                  }
                }}
                disabled={isAnalyzing}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Upload Area */}
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />

              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/20 p-8 text-center cursor-pointer transition hover:border-primary/50 hover:bg-secondary/40"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:scale-110">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Click to select an image or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or WebP campus gate photo</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl border border-border overflow-hidden bg-black/5 flex items-center justify-center max-h-[300px]">
                    <img src={previewUrl} alt="Preview" className="h-auto max-h-[300px] w-auto object-contain rounded-lg" />
                    {!isAnalyzing && (
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setAnalysisResult(null);
                        }}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground truncate">
                      File: <span className="font-mono font-medium text-foreground">{selectedFile?.name}</span> ({(Number(selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                    </div>
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={handleRunAnalysis}
                      className="btn-primary text-sm inline-flex items-center gap-2 shadow-sm"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Processing AI Pipeline…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-emerald-400" /> Run AI Analysis
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Progress message */}
              {isAnalyzing && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3 animate-pulse">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">AI Processing in Progress</p>
                    <p className="text-muted-foreground mt-0.5">{analysisStep}</p>
                  </div>
                </div>
              )}

              {/* Analysis Results Card */}
              {analysisResult && (
                <div className="rounded-xl border border-border bg-secondary/10 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <h3 className="text-sm font-semibold">AI Detection Breakdown</h3>
                    </div>
                    {analysisResult.emptyFrame ? (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        Empty Frame Discarded
                      </span>
                    ) : (
                      <StatusBadge status={analysisResult.status} />
                    )}
                  </div>

                  {analysisResult.emptyFrame ? (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">No person was detected in this frame.</p>
                      <p>The AI model discarded this frame without logging a false detection record, keeping attendance logs clean.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-card p-3 border border-border">
                        <span className="text-muted-foreground block mb-1">Identified Student</span>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm text-foreground">
                            {analysisResult.student_name || "Unidentified Person"}
                          </span>
                        </div>
                        {analysisResult.students?.usn && (
                          <span className="font-mono text-[11px] text-muted-foreground mt-0.5 block">
                            USN: {analysisResult.students.usn}
                          </span>
                        )}
                      </div>

                      <div className="rounded-lg bg-card p-3 border border-border">
                        <span className="text-muted-foreground block mb-1">Facial Match Similarity</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold text-emerald-600">
                            {(Number(analysisResult.face_similarity || 0) * 100).toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (Confidence: {(Number(analysisResult.confidence || 0) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-card p-3 border border-border">
                        <span className="text-muted-foreground block mb-1">ID Card / Lanyard</span>
                        <div className="flex items-center gap-2">
                          <YesNoBadge yes={analysisResult.id_card_found} />
                          {analysisResult.id_card_found && analysisResult.id_card_color && (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-black/20"
                                style={{ backgroundColor: analysisResult.id_card_color }}
                              />
                              {analysisResult.id_card_color}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-card p-3 border border-border">
                        <span className="text-muted-foreground block mb-1">Branch Color Verification</span>
                        <div className="flex items-center gap-1.5">
                          {analysisResult.color_match === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Matched Department
                            </span>
                          ) : analysisResult.color_match === false ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Color Mismatch
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!analysisResult.emptyFrame && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setTestModalOpen(false);
                          navigate({ to: "/detections/$id", params: { id: analysisResult.id } });
                        }}
                        className="btn-ghost text-xs inline-flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Full Detection Record
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectCls =
  "rounded-lg border border-input bg-background/60 text-foreground px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function escapeCsv(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

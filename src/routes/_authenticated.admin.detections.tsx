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
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, YesNoBadge } from "@/components/student/StatusBadge";

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
};

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

  // Test Modal states
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        .select("id, detection_time, id_card_found, status, student_name, branch_id, branches(code, name), students(usn), is_repeat, repeat_count")
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

      <div className="card-surface p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2 group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-500 group-focus-within:rotate-[360deg] group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typewriterText}
              className="w-full rounded-md border border-input bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
            <option value="all">All branches</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={selectCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>
          <select value={idFound} onChange={(e) => setIdFound(e.target.value as any)} className={selectCls}>
            <option value="all">ID: all</option>
            <option value="yes">ID worn</option>
            <option value="no">ID missing</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${selectCls} w-full text-xs`}
              title="From date"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${selectCls} w-full text-xs`}
              title="To date"
            />
          </div>
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
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">USN</th>
                  <th className="px-6 py-3">Branch</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {filtered.map((r) => {
                  const d = new Date(r.detection_time);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: "/detections/$id", params: { id: r.id } })}
                      className="cursor-pointer hover:bg-secondary/30 transition-colors"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-foreground">
                        {d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-foreground flex items-center gap-2">
                        <span className="font-semibold">{r.student_name ?? "Unknown"}</span>
                        {r.is_repeat && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            Repeat ({r.repeat_count})
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-muted-foreground">{r.students?.usn ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">{r.branches?.code ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-3.5"><YesNoBadge yes={r.id_card_found} /></td>
                      <td className="whitespace-nowrap px-6 py-3.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {rows.data?.length ?? 0} records.</p>

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
  "rounded-md border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function escapeCsv(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Client-side file upload validation for profile photos.
// Server-side, Supabase Storage bucket policies + RLS enforce access;
// this layer guards against oversized uploads, wrong MIME, and unsafe
// extensions before we make a network call.

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type PhotoValidation =
  | { ok: true; ext: string }
  | { ok: false; reason: string };

export function validatePhotoFile(file: File): PhotoValidation {
  if (!file) return { ok: false, reason: "No file selected" };
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, reason: "Please choose a JPG, PNG, WebP, or GIF image" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "Image is too large — keep it under 5 MB" };
  }
  const raw = (file.name.split(".").pop() ?? "").toLowerCase();
  // Whitelist the extension we'll use in the storage path — prevents anything
  // interpreted as a traversal segment or unexpected suffix from reaching storage.
  const ext = ALLOWED_EXT.has(raw) ? raw : "jpg";
  return { ok: true, ext };
}

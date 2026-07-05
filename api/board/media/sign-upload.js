import crypto from "node:crypto";
import { requireAuth } from "../../_auth.js";
import {
  ensureBoardMediaBucket,
  getBoardMediaBucket,
  getSupabase,
  sendError,
  sendJson,
} from "../../_supabase.js";

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

function sanitizeFilename(value) {
  return String(value || "upload")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "upload";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const authPayload = await requireAuth(req);
    const mime = String(req.body?.mime || "").toLowerCase();
    const size = Number(req.body?.size || 0);
    const mediaType = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "";
    const extension = MIME_EXTENSIONS[mime];
    const maxBytes = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (!mediaType || !extension) {
      sendJson(res, 400, { error: "Unsupported media type." });
      return;
    }
    if (!size || size > maxBytes) {
      sendJson(res, 400, { error: "File is too large." });
      return;
    }

    await ensureBoardMediaBucket();

    const supabase = getSupabase();
    const bucket = getBoardMediaBucket();
    const safeName = sanitizeFilename(req.body?.name);
    const random = crypto.randomBytes(8).toString("hex");
    const path = `${authPayload.sub}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${random}-${safeName}.${extension}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    sendJson(res, 200, {
      ok: true,
      bucket,
      path,
      signedUrl: data.signedUrl,
      token: data.token,
      publicUrl,
      mediaType,
      mime,
      size,
    });
  } catch (error) {
    sendError(res, error);
  }
}

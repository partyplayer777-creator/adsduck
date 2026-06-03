import { createClient } from "@supabase/supabase-js";

const BOARD_MEDIA_BUCKET = process.env.SUPABASE_BOARD_MEDIA_BUCKET || "board-media";
let client = null;

export function getSupabase() {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error("Supabase is not configured.");
    error.status = 503;
    throw error;
  }

  if (!client) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}

export function getBoardMediaBucket() {
  return BOARD_MEDIA_BUCKET;
}

export async function ensureBoardMediaBucket() {
  const supabase = getSupabase();
  const bucket = getBoardMediaBucket();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!error && data) return data;

  const { data: created, error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 40 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],
  });
  if (createError) throw createError;
  return created;
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, {
    error: status >= 500 ? "Internal Server Error" : error.message,
  });
  if (status >= 500) console.error("[api]", error);
}

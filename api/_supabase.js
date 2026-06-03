import { createClient } from "@supabase/supabase-js";

const BOARD_MEDIA_BUCKET = process.env.SUPABASE_BOARD_MEDIA_BUCKET || "board-media";
const BOARD_DATA_BUCKET = process.env.SUPABASE_BOARD_DATA_BUCKET || "board-data";
let client = null;

export function getSupabase() {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.project_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || "").trim();

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

export function getBoardDataBucket() {
  return BOARD_DATA_BUCKET;
}

async function ensureBucket({ name, publicBucket, fileSizeLimit, allowedMimeTypes }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.getBucket(name);
  if (!error && data) return data;

  const { data: created, error: createError } = await supabase.storage.createBucket(name, {
    public: publicBucket,
    fileSizeLimit,
    allowedMimeTypes,
  });
  if (createError) throw createError;
  return created;
}

export async function ensureBoardMediaBucket() {
  return ensureBucket({
    name: getBoardMediaBucket(),
    publicBucket: true,
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
}

export async function ensureBoardDataBucket() {
  return ensureBucket({
    name: getBoardDataBucket(),
    publicBucket: false,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["application/json"],
  });
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

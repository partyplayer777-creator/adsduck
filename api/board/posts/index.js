import { requireAuth } from "../../_auth.js";
import { getSupabase, sendError, sendJson } from "../../_supabase.js";

const VALID_BOARDS = new Set(["anonymous", "realname"]);

function normalizePostPayload(payload, authPayload) {
  const board = VALID_BOARDS.has(payload?.board) ? payload.board : "anonymous";
  const title = String(payload?.title || "").trim();
  const content = String(payload?.content || "").trim();
  if (!title) {
    const error = new Error("title is required.");
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();
  return {
    ...payload,
    id: payload?.id || `post-${Date.now()}`,
    board,
    title,
    content,
    authorId: authPayload.sub,
    authorName: payload?.authorName || authPayload.display_name || authPayload.email || "사용자",
    createdAt: payload?.createdAt || now,
    likes: Number(payload?.likes || 0),
    likedBy: Array.isArray(payload?.likedBy) ? payload.likedBy : [],
    penaltyPoints: Number(payload?.penaltyPoints || 0),
    media: Array.isArray(payload?.media) ? payload.media : [],
    comments: Array.isArray(payload?.comments) ? payload.comments : [],
  };
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === "GET") {
      const board = VALID_BOARDS.has(req.query.board) ? req.query.board : null;
      let query = supabase
        .from("board_posts")
        .select("id, board, payload, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (board) query = query.eq("board", board);

      const { data, error } = await query;
      if (error) throw error;
      sendJson(res, 200, {
        ok: true,
        posts: (data || []).map((row) => row.payload),
        source: "supabase",
      });
      return;
    }

    if (req.method === "POST") {
      const authPayload = requireAuth(req);
      const payload = normalizePostPayload(req.body || {}, authPayload);
      const row = {
        id: payload.id,
        board: payload.board,
        user_id: authPayload.sub,
        payload,
      };

      const { data, error } = await supabase
        .from("board_posts")
        .insert(row)
        .select("payload")
        .single();
      if (error) throw error;
      sendJson(res, 201, { ok: true, post: data.payload });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
}

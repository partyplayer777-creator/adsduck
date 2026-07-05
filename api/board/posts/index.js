import { requireAuth } from "../../_auth.js";
import { getSupabase, sendError, sendJson } from "../../_supabase.js";
import { getSharedBoardPosts, insertSharedBoardPost } from "../_store.js";

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
      const result = await getSharedBoardPosts(supabase, board);
      sendJson(res, 200, {
        ok: true,
        posts: result.posts,
        source: result.source,
      });
      return;
    }

    if (req.method === "POST") {
      const authPayload = await requireAuth(req);
      const payload = normalizePostPayload(req.body || {}, authPayload);
      const row = {
        id: payload.id,
        board: payload.board,
        user_id: authPayload.sub,
        payload,
      };

      const result = await insertSharedBoardPost(supabase, row);
      sendJson(res, 201, { ok: true, post: result.post, source: result.source });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
}

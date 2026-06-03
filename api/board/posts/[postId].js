import { requireAuth } from "../../_auth.js";
import { getSupabase, sendError, sendJson } from "../../_supabase.js";

const VALID_BOARDS = new Set(["anonymous", "realname"]);

export default async function handler(req, res) {
  try {
    if (req.method !== "PUT") {
      res.setHeader("Allow", "PUT");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const authPayload = requireAuth(req);
    const postId = String(req.query.postId || "");
    const payload = req.body || {};
    if (!postId || payload.id !== postId) {
      sendJson(res, 400, { error: "postId mismatch." });
      return;
    }

    const board = VALID_BOARDS.has(payload.board) ? payload.board : "anonymous";
    const normalized = {
      ...payload,
      board,
      title: String(payload.title || "").trim(),
      content: String(payload.content || "").trim(),
      media: Array.isArray(payload.media) ? payload.media : [],
      comments: Array.isArray(payload.comments) ? payload.comments : [],
      likedBy: Array.isArray(payload.likedBy) ? payload.likedBy : [],
      updatedAt: new Date().toISOString(),
    };

    if (!normalized.title) {
      sendJson(res, 400, { error: "title is required." });
      return;
    }

    const supabase = getSupabase();
    const { data: existing, error: findError } = await supabase
      .from("board_posts")
      .select("payload")
      .eq("id", postId)
      .single();
    if (findError) throw findError;

    normalized.authorId = existing.payload?.authorId || normalized.authorId || authPayload.sub;
    normalized.authorName = existing.payload?.authorName || normalized.authorName || "사용자";
    normalized.createdAt = existing.payload?.createdAt || normalized.createdAt || new Date().toISOString();

    const { data, error } = await supabase
      .from("board_posts")
      .update({
        board,
        payload: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .select("payload")
      .single();
    if (error) throw error;

    sendJson(res, 200, { ok: true, post: data.payload });
  } catch (error) {
    sendError(res, error);
  }
}

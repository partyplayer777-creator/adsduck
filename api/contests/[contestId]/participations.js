import { sendError, sendJson } from "../../_supabase.js";
import { getAuthPayload, getContestId, joinContest } from "../_shared.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const authPayload = await getAuthPayload(req);
    const contestId = getContestId(req);
    const participation = await joinContest({
      contestId,
      authPayload,
      profilePayload: req.body?.profile || null,
    });

    sendJson(res, 200, { ok: true, participation });
  } catch (error) {
    sendError(res, error);
  }
}

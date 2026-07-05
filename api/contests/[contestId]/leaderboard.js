import { sendError, sendJson } from "../../_supabase.js";
import { getContestId, getLeaderboard } from "../_shared.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    const contestId = getContestId(req);
    sendJson(res, 200, await getLeaderboard(contestId));
  } catch (error) {
    sendError(res, error);
  }
}

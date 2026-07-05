import { sendError, sendJson } from "../../_supabase.js";
import { getAuthPayload, getContestId, submitEntry } from "../_shared.js";

const VALID_PROTOCOLS = new Set(["https:", "http:"]);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const { platform, snsUrl, title, profile } = req.body || {};
    if (!platform || !snsUrl) {
      sendJson(res, 400, { error: "platform and snsUrl are required." });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(snsUrl);
    } catch {
      sendJson(res, 400, { error: "snsUrl must be a valid URL." });
      return;
    }

    if (!VALID_PROTOCOLS.has(parsedUrl.protocol)) {
      sendJson(res, 400, { error: "snsUrl must be a valid URL." });
      return;
    }

    const authPayload = await getAuthPayload(req);
    const contestId = getContestId(req);
    const entry = await submitEntry({
      contestId,
      authPayload,
      payload: {
        platform,
        snsUrl,
        title,
        profile,
      },
    });

    sendJson(res, 200, { ok: true, entry, created: entry.created });
  } catch (error) {
    sendError(res, error);
  }
}

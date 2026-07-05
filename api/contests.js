import { sendError, sendJson } from "./_supabase.js";
import { getAuthPayload, getLeaderboard, joinContest, submitEntry } from "./contests/_shared.js";

const VALID_PROTOCOLS = new Set(["https:", "http:"]);

function parsePath(req) {
  return String(req.query?.path || "").split("/").filter(Boolean);
}

function getPathContestId(parts) {
  const contestId = String(parts[0] || "").trim();
  if (!contestId) {
    const error = new Error("contestId is required.");
    error.status = 400;
    throw error;
  }
  return contestId;
}

function validateSnsUrl(snsUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(snsUrl);
  } catch {
    return false;
  }
  return VALID_PROTOCOLS.has(parsedUrl.protocol);
}

async function handleLeaderboard(req, res, contestId) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 200, await getLeaderboard(contestId));
}

async function handleParticipation(req, res, contestId) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const authPayload = await getAuthPayload(req);
  const participation = await joinContest({
    contestId,
    authPayload,
    profilePayload: req.body?.profile || null,
  });

  sendJson(res, 200, { ok: true, participation });
}

async function handleEntry(req, res, contestId) {
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

  if (!validateSnsUrl(snsUrl)) {
    sendJson(res, 400, { error: "snsUrl must be a valid URL." });
    return;
  }

  const authPayload = await getAuthPayload(req);
  const entry = await submitEntry({
    contestId,
    authPayload,
    payload: { platform, snsUrl, title, profile },
  });

  sendJson(res, 200, { ok: true, entry, created: entry.created });
}

export default async function handler(req, res) {
  try {
    const parts = parsePath(req);
    const contestId = getPathContestId(parts);
    const resource = parts[1] || "";

    if (resource === "leaderboard") {
      await handleLeaderboard(req, res, contestId);
      return;
    }

    if (resource === "participations") {
      await handleParticipation(req, res, contestId);
      return;
    }

    if (resource === "entries") {
      await handleEntry(req, res, contestId);
      return;
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendError(res, error);
  }
}

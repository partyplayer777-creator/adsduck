import { sendError, sendJson } from "./_supabase.js";
import { getAuthPayload, getLeaderboard, joinContest, submitEntry } from "./contests/_shared.js";

const VALID_PROTOCOLS = new Set(["https:", "http:"]);
const YOUTUBE_ONLY_CONTEST_IDS = new Set(["9"]);

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

function isYouTubeOnlyContestId(contestId) {
  return YOUTUBE_ONLY_CONTEST_IDS.has(String(contestId));
}

function isYouTubeUrl(snsUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(snsUrl);
  } catch {
    return false;
  }

  if (!VALID_PROTOCOLS.has(parsedUrl.protocol)) return false;

  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
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

  const youtubeOnly = isYouTubeOnlyContestId(contestId);
  if (youtubeOnly && (platform !== "youtube" || !isYouTubeUrl(snsUrl))) {
    sendJson(res, 400, { error: "This contest only accepts YouTube links." });
    return;
  }

  const authPayload = await getAuthPayload(req);
  const entry = await submitEntry({
    contestId,
    authPayload,
    payload: { platform: youtubeOnly ? "youtube" : platform, snsUrl, title, profile },
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

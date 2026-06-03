import { verifyAccessToken } from "../../../_auth.js";

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { error: status >= 500 ? "Internal Server Error" : error.message });
  if (status >= 500) console.error("[api/organizer/verification/pass/start]", error);
}

function makeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function optionalAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const startUrl = process.env.PASS_VERIFICATION_START_URL || "";
    if (!startUrl) throw makeError(501, "PASS_VERIFICATION_START_URL is not configured.");

    const user = optionalAuth(req);
    const response = await fetch(startUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: process.env.PASS_VERIFICATION_CLIENT_ID || "",
        returnUrl: req.body?.returnUrl || "https://adsduck.com/?organizer=1",
        context: {
          purpose: "adsduck-organizer-verification",
          userId: user?.sub || null,
          email: user?.email || "",
        },
      }),
    });

    const text = await response.text();
    const data = parseJson(text);
    if (!response.ok) {
      throw makeError(response.status, data?.message || data?.error || "PASS verification failed.");
    }

    sendJson(res, 200, data);
  } catch (error) {
    sendError(res, error);
  }
}

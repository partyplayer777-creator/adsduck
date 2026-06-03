import crypto from "node:crypto";
import { config } from "../config.mjs";

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseJsonPart(value) {
  return JSON.parse(base64UrlDecode(value).toString("utf8"));
}

export function verifyAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed access token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Unsupported access token format");
  }

  const expected = crypto
    .createHmac("sha256", config.auth.accessTokenSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const presented = base64UrlDecode(encodedSignature);

  if (presented.length !== expected.length || !crypto.timingSafeEqual(presented, expected)) {
    throw new Error("Invalid access token signature");
  }

  const payload = parseJsonPart(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.type !== "access") throw new Error("Unsupported token type");
  if (payload.exp && payload.exp <= now) throw new Error("Access token expired");
  if (config.auth.issuer && payload.iss !== config.auth.issuer) throw new Error("Invalid token issuer");
  if (config.auth.clientId && payload.aud !== config.auth.clientId) throw new Error("Invalid token audience");

  return payload;
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) {
    req.auth = null;
    next();
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
  } catch {
    req.auth = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}


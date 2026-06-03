import crypto from "node:crypto";

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseJsonPart(value) {
  return JSON.parse(base64UrlDecode(value).toString("utf8"));
}

export function verifyAccessToken(token) {
  const secret = process.env.AUTH_ACCESS_TOKEN_SECRET || "";
  if (!secret) {
    const error = new Error("Auth is not configured.");
    error.status = 503;
    throw error;
  }

  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    const error = new Error("Malformed access token.");
    error.status = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    const error = new Error("Unsupported access token format.");
    error.status = 401;
    throw error;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const presented = base64UrlDecode(encodedSignature);

  if (presented.length !== expected.length || !crypto.timingSafeEqual(presented, expected)) {
    const error = new Error("Invalid access token signature.");
    error.status = 401;
    throw error;
  }

  const payload = parseJsonPart(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const issuer = process.env.AUTH_TOKEN_ISSUER || "";
  const clientId = process.env.AUTH_CLIENT_ID || "adsduck";

  if (payload.type !== "access") throw Object.assign(new Error("Unsupported token type."), { status: 401 });
  if (payload.exp && payload.exp <= now) throw Object.assign(new Error("Access token expired."), { status: 401 });
  if (issuer && payload.iss !== issuer) throw Object.assign(new Error("Invalid token issuer."), { status: 401 });
  if (clientId && payload.aud !== clientId) throw Object.assign(new Error("Invalid token audience."), { status: 401 });

  return payload;
}

export function requireAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  return verifyAccessToken(token);
}

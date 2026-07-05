import crypto from "node:crypto";
import { config } from "../config.mjs";

const JWKS_TTL_MS = 5 * 60 * 1000;
let jwksCache = { url: "", keys: [], expiresAt: 0 };

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseJsonPart(value) {
  return JSON.parse(base64UrlDecode(value).toString("utf8"));
}

function getSupabaseIssuer() {
  return config.supabaseUrl ? `${config.supabaseUrl}/auth/v1` : "";
}

function getSupabaseJwksUrl() {
  const issuer = getSupabaseIssuer();
  return issuer ? `${issuer}/.well-known/jwks.json` : "";
}

function timingSafeEqualSignature(encodedSignature, expected) {
  const presented = base64UrlDecode(encodedSignature);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

function verifyHs256Signature({ encodedHeader, encodedPayload, encodedSignature }) {
  for (const secret of config.auth.tokenSecrets) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

    if (timingSafeEqualSignature(encodedSignature, expected)) {
      return true;
    }
  }

  return false;
}

async function getJwks() {
  const url = getSupabaseJwksUrl();
  if (!url) return [];

  if (jwksCache.url === url && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Failed to load Supabase signing keys");
  }

  const data = await response.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { url, keys, expiresAt: Date.now() + JWKS_TTL_MS };
  return keys;
}

async function verifyJwksSignature({ header, encodedHeader, encodedPayload, encodedSignature }) {
  if (!header.kid) return false;

  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid && key.alg === header.alg);
  if (!jwk) return false;

  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlDecode(encodedSignature);

  if (header.alg === "ES256") {
    return crypto.verify("sha256", signingInput, { key, dsaEncoding: "ieee-p1363" }, signature);
  }

  if (header.alg === "RS256") {
    return crypto.verify("RSA-SHA256", signingInput, key, signature);
  }

  return false;
}

function audienceMatches(audience, expected) {
  if (Array.isArray(audience)) return audience.includes(expected);
  return audience === expected;
}

function assertSupabaseIssuer(payload) {
  const issuer = getSupabaseIssuer();
  if (issuer && payload.iss !== issuer) {
    throw new Error("Invalid token issuer");
  }
}

function isSupabaseUserToken(payload) {
  return (
    !!payload?.sub &&
    payload.role === "authenticated" &&
    audienceMatches(payload.aud, "authenticated")
  );
}

function normalizeSupabasePayload(payload) {
  const metadata = payload.user_metadata && typeof payload.user_metadata === "object"
    ? payload.user_metadata
    : {};
  const appMetadata = payload.app_metadata && typeof payload.app_metadata === "object"
    ? payload.app_metadata
    : {};
  const displayName =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    (payload.email ? String(payload.email).split("@")[0] : null);
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  return {
    ...payload,
    type: "supabase_access",
    email: payload.email || metadata.email || null,
    display_name: displayName,
    name: metadata.full_name || metadata.name || displayName,
    avatar_url: avatarUrl,
    profile_image: avatarUrl,
    provider: appMetadata.provider || null,
    providers: appMetadata.providers || [],
    marketing_consent: !!metadata.marketing_consent,
  };
}

export async function verifyAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed access token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  const supportedAlgorithms = new Set(["HS256", "ES256", "RS256"]);
  if (!supportedAlgorithms.has(header.alg) || (header.typ && header.typ !== "JWT")) {
    throw new Error("Unsupported access token format");
  }

  const payload = parseJsonPart(encodedPayload);
  let signatureValid = false;

  if (header.alg === "HS256") {
    signatureValid = verifyHs256Signature({ encodedHeader, encodedPayload, encodedSignature });
  } else {
    signatureValid = await verifyJwksSignature({ header, encodedHeader, encodedPayload, encodedSignature });
  }

  if (!signatureValid) {
    throw new Error("Invalid access token signature");
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp <= now) throw new Error("Access token expired");
  if (payload.nbf && payload.nbf > now) throw new Error("Access token is not active yet");

  if (payload.type === "access") {
    if (config.auth.issuer && payload.iss !== config.auth.issuer) throw new Error("Invalid token issuer");
    if (config.auth.clientId && !audienceMatches(payload.aud, config.auth.clientId)) {
      throw new Error("Invalid token audience");
    }
    return payload;
  }

  if (isSupabaseUserToken(payload)) {
    assertSupabaseIssuer(payload);
    return normalizeSupabasePayload(payload);
  }

  throw new Error("Unsupported token type");
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) {
    req.auth = null;
    next();
    return;
  }

  try {
    req.auth = await verifyAccessToken(token);
  } catch {
    req.auth = null;
  }
  next();
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.auth = await verifyAccessToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}

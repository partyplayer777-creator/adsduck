import crypto from "node:crypto";

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

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getTokenSecrets() {
  return uniqueNonEmpty([
    process.env.AUTH_ACCESS_TOKEN_SECRET,
    process.env.SUPABASE_JWT_SECRET,
    process.env.SUPABASE_AUTH_JWT_SECRET,
    process.env.Lagacy_JWT_SECRET,
    process.env.LEGACY_JWT_SECRET,
    process.env.JWT_SECRET,
    process.env.jwt_secret,
    process.env.jwt_keys,
  ]);
}

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.project_URL || "").trim().replace(/\/$/, "");
}

function getSupabaseIssuer() {
  const supabaseUrl = getSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/auth/v1` : "";
}

function getSupabaseJwksUrl() {
  const issuer = getSupabaseIssuer();
  return issuer ? `${issuer}/.well-known/jwks.json` : "";
}

function timingSafeEqualSignature(encodedSignature, expected) {
  const presented = base64UrlDecode(encodedSignature);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

function verifyHs256Signature({ encodedHeader, encodedPayload, encodedSignature, secrets }) {
  for (const secret of secrets) {
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
    throw Object.assign(new Error("Failed to load Supabase signing keys."), { status: 503 });
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
    throw Object.assign(new Error("Invalid token issuer."), { status: 401 });
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
    const error = new Error("Malformed access token.");
    error.status = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  const supportedAlgorithms = new Set(["HS256", "ES256", "RS256"]);
  if (!supportedAlgorithms.has(header.alg) || (header.typ && header.typ !== "JWT")) {
    const error = new Error("Unsupported access token format.");
    error.status = 401;
    throw error;
  }

  const payload = parseJsonPart(encodedPayload);
  let signatureValid = false;

  if (header.alg === "HS256") {
    signatureValid = verifyHs256Signature({
      encodedHeader,
      encodedPayload,
      encodedSignature,
      secrets: getTokenSecrets(),
    });
  } else {
    signatureValid = await verifyJwksSignature({ header, encodedHeader, encodedPayload, encodedSignature });
  }

  if (!signatureValid) {
    const error = new Error("Invalid access token signature.");
    error.status = 401;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const issuer = process.env.AUTH_TOKEN_ISSUER || "";
  const clientId = process.env.AUTH_CLIENT_ID || "adsduck";

  if (payload.exp && payload.exp <= now) throw Object.assign(new Error("Access token expired."), { status: 401 });
  if (payload.nbf && payload.nbf > now) throw Object.assign(new Error("Access token is not active yet."), { status: 401 });

  if (payload.type === "access") {
    if (issuer && payload.iss !== issuer) throw Object.assign(new Error("Invalid token issuer."), { status: 401 });
    if (clientId && !audienceMatches(payload.aud, clientId)) {
      throw Object.assign(new Error("Invalid token audience."), { status: 401 });
    }
    return payload;
  }

  if (isSupabaseUserToken(payload)) {
    assertSupabaseIssuer(payload);
    return normalizeSupabasePayload(payload);
  }

  throw Object.assign(new Error("Unsupported token type."), { status: 401 });
}

export async function requireAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  return verifyAccessToken(token);
}

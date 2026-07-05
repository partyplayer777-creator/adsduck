import "dotenv/config";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

const authTokenSecrets = uniqueNonEmpty([
  process.env.AUTH_ACCESS_TOKEN_SECRET,
  process.env.SUPABASE_JWT_SECRET,
  process.env.SUPABASE_AUTH_JWT_SECRET,
  process.env.Lagacy_JWT_SECRET,
  process.env.LEGACY_JWT_SECRET,
  process.env.JWT_SECRET,
  process.env.jwt_secret,
  process.env.jwt_keys,
]);

export const config = {
  port: Number(process.env.PORT || 4100),
  publicBaseUrl: trimTrailingSlash(process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4100}`),
  webOrigin: trimTrailingSlash(process.env.WEB_ORIGIN || "http://localhost:5173"),
  supabaseUrl: trimTrailingSlash(process.env.SUPABASE_URL || process.env.project_URL || ""),
  supabaseServiceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || "").trim(),
  auth: {
    accessTokenSecret: authTokenSecrets[0] || "",
    tokenSecrets: authTokenSecrets,
    issuer: process.env.AUTH_TOKEN_ISSUER || "",
    clientId: process.env.AUTH_CLIENT_ID || "adsduck",
  },
  paymentKit: {
    baseUrl: trimTrailingSlash(process.env.PAYMENT_KIT_BASE_URL || ""),
    projectKey: process.env.PAYMENT_KIT_PROJECT_KEY || "adsduck",
  },
  organizerPaymentCodeAdminSecret: process.env.ORGANIZER_PAYMENT_CODE_ADMIN_SECRET || "",
  lectureAdminSecret: process.env.LECTURE_ADMIN_SECRET || "",
  businessVerification: {
    baseUrl: trimTrailingSlash(process.env.NTS_BUSINESS_API_BASE_URL || "https://api.odcloud.kr"),
    serviceKey: process.env.NTS_BUSINESS_SERVICE_KEY || "",
  },
  passVerification: {
    startUrl: trimTrailingSlash(process.env.PASS_VERIFICATION_START_URL || ""),
    clientId: process.env.PASS_VERIFICATION_CLIENT_ID || "",
  },
  metricsSyncSecret: process.env.METRICS_SYNC_SECRET || "",
  leaderboardStreamIntervalMs: Number(process.env.LEADERBOARD_STREAM_INTERVAL_MS || 5000),
};

export function validateConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (config.auth.tokenSecrets.length === 0 && !config.supabaseUrl) {
    missing.push("SUPABASE_URL or SUPABASE_JWT_SECRET");
  }
  return missing;
}

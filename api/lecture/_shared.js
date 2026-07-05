import { verifyAccessToken } from "../_auth.js";

export const MEMBERSHIP_PLANS = [
  { key: "1m", label: "1개월", points: 50000, months: 1 },
  { key: "3m", label: "3개월", points: 120000, months: 3 },
  { key: "6m", label: "6개월", points: 200000, months: 6 },
];

export async function getOptionalAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (!token) return null;
  if (scheme !== "Bearer") {
    const error = new Error("Malformed authorization header.");
    error.status = 401;
    throw error;
  }
  return verifyAccessToken(token);
}

export function requireLectureAdmin(req) {
  const expected = String(
    process.env.LECTURE_ADMIN_SECRET ||
    process.env.ORGANIZER_PAYMENT_CODE_ADMIN_SECRET ||
    ""
  ).trim();
  const presented = String(
    req.headers["x-lecture-admin-secret"] ||
    req.headers["x-admin-secret"] ||
    ""
  ).trim();

  if (!expected || presented !== expected) {
    const error = new Error("Lecture admin authorization required.");
    error.status = 403;
    throw error;
  }
}

export async function ensureProfile(supabase, authPayload) {
  if (!authPayload?.sub) return null;

  const profile = {
    id: authPayload.sub,
    display_name: authPayload.display_name || authPayload.name || null,
    email: authPayload.email || null,
    avatar_url: authPayload.avatar_url || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("id, display_name, email, avatar_url")
    .single();

  if (error) throw error;
  return data;
}

export async function ensureWallet(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("ensure_point_wallet", {
    p_user_id: userId,
  });
  if (error) throw error;
  return normalizeWallet(data);
}

export function normalizeWallet(wallet) {
  if (!wallet) return null;
  return {
    userId: wallet.user_id || wallet.userId || null,
    balance: Number(wallet.balance || 0),
    createdAt: wallet.created_at || wallet.createdAt || null,
    updatedAt: wallet.updated_at || wallet.updatedAt || null,
  };
}

export function normalizeMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    planKey: row.plan_key,
    paidPoints: Number(row.paid_points || 0),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function normalizeAccess(row) {
  if (!row) {
    return {
      readCount: 0,
      remainingReads: 3,
      isSubscribed: false,
      isLocked: false,
      lockedAt: null,
      subscribedAt: null,
      lastReadAt: null,
    };
  }

  const readCount = Number(row.read_count ?? row.readCount ?? 0);
  const lockedAt = row.locked_at ?? row.lockedAt ?? null;
  const isSubscribed = Boolean(row.is_subscribed ?? row.isSubscribed ?? false);
  return {
    readCount,
    remainingReads: Number(row.remainingReads ?? Math.max(0, 3 - readCount)),
    isSubscribed,
    isLocked: Boolean(row.isLocked ?? lockedAt),
    lockedAt,
    subscribedAt: row.subscribed_at ?? row.subscribedAt ?? null,
    lastReadAt: row.last_read_at ?? row.lastReadAt ?? null,
  };
}

export function normalizePost(row, access = null, hasActiveMembership = false) {
  const normalizedAccess = normalizeAccess(access);
  const subscribePrice = Number(row.subscribe_price ?? row.subscribePrice ?? 0);
  const isLocked = normalizedAccess.isLocked && !normalizedAccess.isSubscribed && !hasActiveMembership;

  return {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    authorId: row.author_id || row.authorId || null,
    authorName: row.author_name || row.authorName || "AdsDuck AI",
    status: row.status,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    readPrice: Number(row.read_price ?? row.readPrice ?? 0),
    subscribePrice,
    unlockPrice: isLocked ? subscribePrice * 5 : subscribePrice,
    publishedAt: row.published_at || row.publishedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    hasActiveMembership,
    access: normalizedAccess,
  };
}

export async function getActiveMembership(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("lecture_memberships")
    .select("id, user_id, plan_key, paid_points, starts_at, expires_at, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeMembership(data);
}

export async function getAccessMap(supabase, userId, postIds) {
  if (!userId || !postIds.length) return new Map();

  const { data, error } = await supabase
    .from("lecture_post_accesses")
    .select("post_id, read_count, is_subscribed, subscribed_at, locked_at, last_read_at")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;
  return new Map((data || []).map((row) => [row.post_id, row]));
}

export function resultStatus(result) {
  if (result?.ok) return 200;
  if (result?.code === "not_found") return 404;
  if (result?.code === "locked") return 423;
  if (result?.code === "insufficient_points") return 402;
  if (result?.code === "invalid_plan" || result?.code === "invalid_amount") return 400;
  return 400;
}

export function makeIdempotencyKey(req, fallbackPrefix) {
  const fromHeader = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  const fromBody = req.body?.idempotencyKey;
  const value = String(fromHeader || fromBody || "").trim();
  if (value) return value.slice(0, 160);
  return `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

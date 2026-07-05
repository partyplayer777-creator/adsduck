import { randomUUID } from "node:crypto";
import { supabase } from "../lib/supabase.mjs";

export const MEMBERSHIP_PLANS = [
  { key: "1m", label: "1개월", points: 50000, months: 1 },
  { key: "3m", label: "3개월", points: 120000, months: 3 },
  { key: "6m", label: "6개월", points: 200000, months: 6 },
];

export function makeIdempotencyKey(req, fallbackPrefix) {
  const fromHeader = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  const fromBody = req.body?.idempotencyKey;
  const value = String(fromHeader || fromBody || "").trim();
  if (value) return value.slice(0, 160);
  return `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resultStatus(result) {
  if (result?.ok) return 200;
  if (result?.code === "not_found") return 404;
  if (result?.code === "locked") return 423;
  if (result?.code === "insufficient_points") return 402;
  if (result?.code === "invalid_plan" || result?.code === "invalid_amount") return 400;
  return 400;
}

export async function ensureProfile(authPayload) {
  if (!authPayload?.sub) return null;

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: authPayload.sub,
      display_name: authPayload.display_name || authPayload.name || null,
      email: authPayload.email || null,
      avatar_url: authPayload.avatar_url || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("id, display_name, email, avatar_url")
    .single();

  if (error) throw error;
  return data;
}

function normalizeWallet(wallet) {
  if (!wallet) return null;
  return {
    userId: wallet.user_id || wallet.userId || null,
    balance: Number(wallet.balance || 0),
    createdAt: wallet.created_at || wallet.createdAt || null,
    updatedAt: wallet.updated_at || wallet.updatedAt || null,
  };
}

function normalizeMembership(row) {
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

function normalizeAccess(row) {
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

function normalizePost(row, access = null, hasActiveMembership = false) {
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

export async function ensureWallet(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("ensure_point_wallet", {
    p_user_id: userId,
  });
  if (error) throw error;
  return normalizeWallet(data);
}

async function getActiveMembership(userId) {
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

async function getAccessMap(userId, postIds) {
  if (!userId || !postIds.length) return new Map();

  const { data, error } = await supabase
    .from("lecture_post_accesses")
    .select("post_id, read_count, is_subscribed, subscribed_at, locked_at, last_read_at")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;
  return new Map((data || []).map((row) => [row.post_id, row]));
}

export async function listLecturePosts(authPayload) {
  let userId = null;
  let wallet = null;
  let membership = null;

  if (authPayload?.sub) {
    await ensureProfile(authPayload);
    userId = authPayload.sub;
    wallet = await ensureWallet(userId);
    membership = await getActiveMembership(userId);
  }

  const { data: rows, error } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const postIds = (rows || []).map((row) => row.id);
  const accessMap = await getAccessMap(userId, postIds);
  const hasActiveMembership = !!membership;

  return {
    ok: true,
    posts: (rows || []).map((row) => normalizePost(row, accessMap.get(row.id), hasActiveMembership)),
    wallet,
    membership,
  };
}

export async function getLecturePost(postId, authPayload) {
  let userId = null;
  let wallet = null;
  let membership = null;

  if (authPayload?.sub) {
    await ensureProfile(authPayload);
    userId = authPayload.sub;
    wallet = await ensureWallet(userId);
    membership = await getActiveMembership(userId);
  }

  const { data: row, error } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("id", postId)
    .in("status", ["published", "hidden"])
    .maybeSingle();

  if (error) throw error;
  if (!row) {
    const notFound = new Error("Lecture post not found.");
    notFound.status = 404;
    throw notFound;
  }

  const accessMap = await getAccessMap(userId, [postId]);
  const access = accessMap.get(postId);
  const hasActiveMembership = !!membership;
  const canReadBody = hasActiveMembership || !!access?.is_subscribed;
  if (row.status !== "published" && !canReadBody) {
    const notFound = new Error("Lecture post not found.");
    notFound.status = 404;
    throw notFound;
  }
  const post = normalizePost(row, access, hasActiveMembership);

  return {
    ok: true,
    post: canReadBody ? { ...post, body: row.body } : post,
    canReadBody,
    wallet,
    membership,
  };
}

export async function readLecturePost(postId, authPayload, idempotencyKey) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase.rpc("lecture_read_post", {
    p_user_id: authPayload.sub,
    p_post_id: postId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function subscribeLecturePost(postId, authPayload, idempotencyKey) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase.rpc("lecture_subscribe_post", {
    p_user_id: authPayload.sub,
    p_post_id: postId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function getLectureMemberships(authPayload) {
  await ensureProfile(authPayload);
  return {
    ok: true,
    plans: MEMBERSHIP_PLANS,
    wallet: await ensureWallet(authPayload.sub),
    membership: await getActiveMembership(authPayload.sub),
  };
}

export async function purchaseLectureMembership(authPayload, planKey, idempotencyKey) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase.rpc("purchase_lecture_membership", {
    p_user_id: authPayload.sub,
    p_plan_key: planKey,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return { ...data, plans: MEMBERSHIP_PLANS };
}

export async function getPointWallet(authPayload) {
  await ensureProfile(authPayload);
  const wallet = await ensureWallet(authPayload.sub);

  const { data, error } = await supabase
    .from("point_transactions")
    .select("id, amount, balance_after, type, description, ref_type, ref_id, metadata, created_at")
    .eq("user_id", authPayload.sub)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return {
    ok: true,
    wallet,
    transactions: (data || []).map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      balanceAfter: Number(row.balance_after || 0),
      type: row.type,
      description: row.description,
      refType: row.ref_type,
      refId: row.ref_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    })),
  };
}

export async function chargePoints(authPayload, amount, idempotencyKey) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase.rpc("credit_points", {
    p_user_id: authPayload.sub,
    p_amount: amount,
    p_description: "Point charge",
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

const ALLOWED_POINT_TYPES = new Set([
  "earn",
  "spend",
  "bonus",
  "penalty",
  "virtue_spend",
  "adjustment",
]);

function normalizePointType(value) {
  const type = String(value || "adjustment").trim().replace("virtue-spend", "virtue_spend");
  return ALLOWED_POINT_TYPES.has(type) ? type : "adjustment";
}

export async function recordPointTransaction(authPayload, payload, idempotencyKey) {
  await ensureProfile(authPayload);
  const amount = Math.trunc(Number(payload?.amount || 0));
  if (!Number.isFinite(amount) || amount === 0) {
    throw Object.assign(new Error("Point transaction amount must not be zero."), { status: 400 });
  }

  const type = normalizePointType(payload?.type);
  const { data, error } = await supabase.rpc("record_point_transaction", {
    p_user_id: authPayload.sub,
    p_amount: amount,
    p_type: type,
    p_description: String(payload?.description || "Point transaction").slice(0, 200),
    p_ref_type: String(payload?.refType || "app_activity").slice(0, 80),
    p_ref_id: String(payload?.refId || type).slice(0, 160),
    p_metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function getLectureAuthorEarnings(authPayload) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase
    .from("lecture_author_earnings")
    .select("id, author_id, post_id, payer_user_id, source, gross_points, author_points, platform_points, status, created_at")
    .eq("author_id", authPayload.sub)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const summary = (data || []).reduce(
    (acc, row) => {
      const authorPoints = Number(row.author_points || 0);
      acc.totalAuthorPoints += authorPoints;
      acc[row.status] = (acc[row.status] || 0) + authorPoints;
      return acc;
    },
    { totalAuthorPoints: 0, pending: 0, available: 0, requested: 0, settled: 0, held: 0, refunded: 0 }
  );

  return {
    ok: true,
    summary,
    earnings: (data || []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      payerUserId: row.payer_user_id,
      source: row.source,
      grossPoints: Number(row.gross_points || 0),
      authorPoints: Number(row.author_points || 0),
      platformPoints: Number(row.platform_points || 0),
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function normalizeAdminPostPayload(payload, existing = null) {
  const title = String(payload?.title ?? existing?.title ?? "").trim();
  const body = String(payload?.body ?? existing?.body ?? "").trim();
  const summary = String(payload?.summary ?? existing?.summary ?? "").trim();
  if (!title) throw Object.assign(new Error("title is required."), { status: 400 });
  if (!body) throw Object.assign(new Error("body is required."), { status: 400 });

  const status = ["draft", "published", "hidden", "deleted"].includes(payload?.status)
    ? payload.status
    : existing?.status || "draft";
  const now = new Date().toISOString();

  return {
    id: existing?.id || String(payload?.id || `ai-letter-${randomUUID()}`).trim(),
    title,
    summary,
    body,
    author_id: payload?.authorId ?? payload?.author_id ?? existing?.author_id ?? null,
    author_name: String(payload?.authorName ?? payload?.author_name ?? existing?.author_name ?? "AdsDuck AI").trim(),
    status,
    category: String(payload?.category ?? existing?.category ?? "ai-education").trim(),
    tags: Array.isArray(payload?.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : existing?.tags || [],
    read_price: Math.max(0, Math.floor(Number(payload?.readPrice ?? payload?.read_price ?? existing?.read_price ?? 500))),
    subscribe_price: Math.max(0, Math.floor(Number(payload?.subscribePrice ?? payload?.subscribe_price ?? existing?.subscribe_price ?? 500))),
    published_at: status === "published" ? payload?.publishedAt || payload?.published_at || existing?.published_at || now : existing?.published_at || null,
    updated_at: existing ? now : undefined,
  };
}

export async function getLectureAdminSummary() {
  const [
    postsResult,
    transactionsResult,
    earningsResult,
    membershipsResult,
    reportsResult,
    settlementsResult,
    priceHistoryResult,
    authorsResult,
  ] = await Promise.all([
    supabase
      .from("lecture_posts")
      .select("id, title, summary, author_id, author_name, status, read_price, subscribe_price, published_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("point_transactions")
      .select("id, user_id, amount, balance_after, type, description, ref_type, ref_id, created_at")
      .in("type", ["lecture_read", "lecture_post_subscription", "lecture_membership", "refund"])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("lecture_author_earnings")
      .select("id, author_id, post_id, source, gross_points, author_points, platform_points, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("lecture_memberships")
      .select("id, user_id, plan_key, paid_points, starts_at, expires_at, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("lecture_content_reports")
      .select("id, reporter_user_id, post_id, reason, detail, status, admin_note, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("lecture_author_settlement_requests")
      .select("id, author_id, requested_points, status, note, admin_note, requested_at, decided_at, settled_at")
      .order("requested_at", { ascending: false })
      .limit(100),
    supabase
      .from("lecture_post_price_history")
      .select("id, post_id, previous_read_price, previous_subscribe_price, next_read_price, next_subscribe_price, reason, changed_by_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("lecture_author_permissions")
      .select("user_id, role, status, approved_by_user_id, approved_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const results = [postsResult, transactionsResult, earningsResult, membershipsResult, reportsResult, settlementsResult, priceHistoryResult, authorsResult];
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  const transactions = transactionsResult.data || [];
  const earnings = earningsResult.data || [];
  const memberships = membershipsResult.data || [];
  const reports = reportsResult.data || [];

  return {
    ok: true,
    summary: {
      transactionSpendPoints: Math.abs(sum(transactions.filter((row) => row.amount < 0), "amount")),
      refundedPoints: sum(transactions.filter((row) => row.type === "refund"), "amount"),
      authorPendingPoints: sum(earnings.filter((row) => row.status === "pending"), "author_points"),
      authorRequestedPoints: sum(earnings.filter((row) => row.status === "requested"), "author_points"),
      authorSettledPoints: sum(earnings.filter((row) => row.status === "settled"), "author_points"),
      activeMemberships: memberships.filter((row) => row.status === "active" && new Date(row.expires_at) > new Date()).length,
      openReports: reports.filter((row) => row.status === "open" || row.status === "reviewing").length,
    },
    posts: postsResult.data || [],
    transactions,
    earnings,
    memberships,
    reports,
    settlements: settlementsResult.data || [],
    priceHistory: priceHistoryResult.data || [],
    authors: authorsResult.data || [],
  };
}

export async function updateLectureAuthorPermission(payload) {
  const userId = String(payload?.userId || payload?.user_id || "").trim();
  if (!userId) throw Object.assign(new Error("userId is required."), { status: 400 });

  const role = ["writer", "editor", "admin"].includes(payload?.role) ? payload.role : "writer";
  const status = ["active", "suspended"].includes(payload?.status) ? payload.status : "active";

  const { data, error } = await supabase
    .from("lecture_author_permissions")
    .upsert({
      user_id: userId,
      role,
      status,
      approved_by_user_id: payload?.actorUserId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("user_id, role, status, approved_by_user_id, approved_at, updated_at")
    .single();
  if (error) throw error;

  await supabase.from("lecture_audit_logs").insert({
    actor_user_id: payload?.actorUserId || null,
    action: "lecture_author_permission_updated",
    target_type: "lecture_author_permission",
    target_id: userId,
    metadata: { role, status },
  });

  return { ok: true, author: data };
}

export async function createLectureAdminPost(payload) {
  const normalized = normalizeAdminPostPayload(payload);
  const { data, error } = await supabase
    .from("lecture_posts")
    .insert(normalized)
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .single();
  if (error) throw error;
  await supabase.from("lecture_audit_logs").insert({
    action: "lecture_post_created",
    target_type: "lecture_post",
    target_id: data.id,
    metadata: { status: data.status },
  });
  return { ok: true, post: data };
}

export async function updateLectureAdminPost(postId, payload, { deleted = false } = {}) {
  const { data: existing, error: findError } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw Object.assign(new Error("Lecture post not found."), { status: 404 });

  await supabase.from("lecture_post_revisions").insert({
    post_id: postId,
    title: existing.title,
    summary: existing.summary || "",
    body: existing.body,
  });

  const normalized = deleted
    ? { status: "deleted", updated_at: new Date().toISOString() }
    : normalizeAdminPostPayload(payload, existing);

  const { data, error } = await supabase
    .from("lecture_posts")
    .update(normalized)
    .eq("id", postId)
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .single();
  if (error) throw error;

  await supabase.from("lecture_audit_logs").insert({
    action: deleted ? "lecture_post_deleted" : "lecture_post_updated",
    target_type: "lecture_post",
    target_id: postId,
    metadata: { status: data.status },
  });

  return { ok: true, post: data };
}

export async function refundLectureTransaction({ actorUserId = "lecture-admin", transactionId, reason = "", revokeAccess = true }) {
  const { data, error } = await supabase.rpc("admin_refund_point_transaction", {
    p_actor_user_id: actorUserId,
    p_transaction_id: transactionId,
    p_reason: reason,
    p_revoke_access: revokeAccess,
  });
  if (error) throw error;
  return data;
}

export async function updateLectureAccess({
  actorUserId = "lecture-admin",
  userId,
  postId,
  readCount = null,
  isSubscribed = null,
  unlock = false,
}) {
  const { data, error } = await supabase.rpc("admin_update_lecture_access", {
    p_actor_user_id: actorUserId,
    p_user_id: userId,
    p_post_id: postId,
    p_read_count: readCount,
    p_is_subscribed: isSubscribed,
    p_unlock: unlock,
  });
  if (error) throw error;
  return data;
}

export async function createLectureReport(authPayload, payload) {
  await ensureProfile(authPayload);
  const postId = String(payload?.postId || "").trim();
  const reason = String(payload?.reason || "").trim();
  const detail = String(payload?.detail || "").trim();
  if (!postId || !reason) throw Object.assign(new Error("postId and reason are required."), { status: 400 });

  const { data, error } = await supabase
    .from("lecture_content_reports")
    .insert({
      reporter_user_id: authPayload.sub,
      post_id: postId,
      reason,
      detail,
    })
    .select("id, reporter_user_id, post_id, reason, detail, status, created_at")
    .single();
  if (error) throw error;
  return { ok: true, report: data };
}

export async function updateLectureReport(reportId, payload) {
  const status = String(payload?.status || "").trim();
  if (!["open", "reviewing", "resolved", "rejected"].includes(status)) {
    throw Object.assign(new Error("Valid status is required."), { status: 400 });
  }

  const { data, error } = await supabase
    .from("lecture_content_reports")
    .update({
      status,
      admin_note: String(payload?.adminNote || payload?.admin_note || ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select("id, reporter_user_id, post_id, reason, detail, status, admin_note, created_at, updated_at")
    .single();
  if (error) throw error;
  await supabase.from("lecture_audit_logs").insert({
    action: "lecture_report_updated",
    target_type: "lecture_content_report",
    target_id: reportId,
    metadata: { status },
  });
  return { ok: true, report: data };
}

export async function getAuthorSettlements(authPayload) {
  await ensureProfile(authPayload);
  const { data, error } = await supabase
    .from("lecture_author_settlement_requests")
    .select("id, author_id, requested_points, status, note, admin_note, requested_at, decided_at, settled_at")
    .eq("author_id", authPayload.sub)
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return { ok: true, settlements: data || [] };
}

export async function requestAuthorSettlement(authPayload, note = "") {
  await ensureProfile(authPayload);
  const { data, error } = await supabase.rpc("request_lecture_author_settlement", {
    p_author_id: authPayload.sub,
    p_note: String(note || ""),
  });
  if (error) throw error;
  return data;
}

export async function settleAuthorRequest({ actorUserId = "lecture-admin", requestId, adminNote = "" }) {
  const { data, error } = await supabase.rpc("admin_settle_lecture_author_request", {
    p_actor_user_id: actorUserId,
    p_request_id: requestId,
    p_admin_note: adminNote,
  });
  if (error) throw error;
  return data;
}

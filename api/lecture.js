import { randomUUID } from "node:crypto";
import { requireAuth } from "./_auth.js";
import { getSupabase, sendError, sendJson } from "./_supabase.js";
import {
  MEMBERSHIP_PLANS,
  ensureProfile,
  ensureWallet,
  getAccessMap,
  getActiveMembership,
  getOptionalAuth,
  makeIdempotencyKey,
  normalizePost,
  requireLectureAdmin,
  resultStatus,
} from "./lecture/_shared.js";

function routeSegments(req) {
  const requestUrl = new URL(req.url || "/api/lecture", `https://${req.headers.host || "localhost"}`);
  const value = req.query.path ?? requestUrl.searchParams.get("path");
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split("/").filter(Boolean);
  return requestUrl.pathname.replace(/^\/api\/lecture\/?/, "").split("/").filter(Boolean);
}

function methodNotAllowed(res, allow) {
  res.setHeader("Allow", allow);
  sendJson(res, 405, { error: "Method not allowed." });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function summarizeEarnings(rows) {
  return rows.reduce(
    (acc, row) => {
      const authorPoints = Number(row.author_points || 0);
      acc.totalAuthorPoints += authorPoints;
      acc[row.status] = (acc[row.status] || 0) + authorPoints;
      return acc;
    },
    { totalAuthorPoints: 0, pending: 0, available: 0, requested: 0, settled: 0, held: 0, refunded: 0 }
  );
}

function normalizePostPayload(payload) {
  const title = String(payload?.title || "").trim();
  const body = String(payload?.body || "").trim();
  const summary = String(payload?.summary || "").trim();
  if (!title) throw Object.assign(new Error("title is required."), { status: 400 });
  if (!body) throw Object.assign(new Error("body is required."), { status: 400 });

  const status = ["draft", "published", "hidden"].includes(payload?.status) ? payload.status : "draft";
  const now = new Date().toISOString();
  return {
    id: String(payload?.id || `ai-letter-${randomUUID()}`).trim(),
    title,
    summary,
    body,
    author_id: payload?.authorId || payload?.author_id || null,
    author_name: String(payload?.authorName || payload?.author_name || "AdsDuck AI").trim(),
    status,
    category: String(payload?.category || "ai-education").trim(),
    tags: Array.isArray(payload?.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    read_price: Math.max(0, Math.floor(Number(payload?.readPrice ?? payload?.read_price ?? 500))),
    subscribe_price: Math.max(0, Math.floor(Number(payload?.subscribePrice ?? payload?.subscribe_price ?? 500))),
    published_at: status === "published" ? payload?.publishedAt || payload?.published_at || now : payload?.publishedAt || payload?.published_at || null,
  };
}

function normalizeUpdatePayload(payload, existing) {
  const title = String(payload?.title ?? existing.title ?? "").trim();
  const body = String(payload?.body ?? existing.body ?? "").trim();
  const summary = String(payload?.summary ?? existing.summary ?? "").trim();
  if (!title) throw Object.assign(new Error("title is required."), { status: 400 });
  if (!body) throw Object.assign(new Error("body is required."), { status: 400 });

  const status = ["draft", "published", "hidden", "deleted"].includes(payload?.status)
    ? payload.status
    : existing.status;
  const now = new Date().toISOString();

  return {
    title,
    summary,
    body,
    author_id: payload?.authorId ?? payload?.author_id ?? existing.author_id,
    author_name: String(payload?.authorName ?? payload?.author_name ?? existing.author_name ?? "AdsDuck AI").trim(),
    status,
    category: String(payload?.category ?? existing.category ?? "ai-education").trim(),
    tags: Array.isArray(payload?.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : existing.tags || [],
    read_price: Math.max(0, Math.floor(Number(payload?.readPrice ?? payload?.read_price ?? existing.read_price ?? 500))),
    subscribe_price: Math.max(0, Math.floor(Number(payload?.subscribePrice ?? payload?.subscribe_price ?? existing.subscribe_price ?? 500))),
    published_at: status === "published" ? payload?.publishedAt || payload?.published_at || existing.published_at || now : existing.published_at,
    updated_at: now,
  };
}

async function handlePostList(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const supabase = getSupabase();
  const authPayload = await getOptionalAuth(req);
  let userId = null;
  let wallet = null;
  let membership = null;

  if (authPayload?.sub) {
    await ensureProfile(supabase, authPayload);
    userId = authPayload.sub;
    wallet = await ensureWallet(supabase, userId);
    membership = await getActiveMembership(supabase, userId);
  }

  const { data: rows, error } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const postIds = (rows || []).map((row) => row.id);
  const accessMap = await getAccessMap(supabase, userId, postIds);
  const hasActiveMembership = !!membership;

  sendJson(res, 200, {
    ok: true,
    posts: (rows || []).map((row) => normalizePost(row, accessMap.get(row.id), hasActiveMembership)),
    wallet,
    membership,
  });
}

async function handlePostDetail(req, res, postId) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  if (!postId) {
    sendJson(res, 400, { error: "postId is required." });
    return;
  }

  const supabase = getSupabase();
  const authPayload = await getOptionalAuth(req);
  let userId = null;
  let wallet = null;
  let membership = null;

  if (authPayload?.sub) {
    await ensureProfile(supabase, authPayload);
    userId = authPayload.sub;
    wallet = await ensureWallet(supabase, userId);
    membership = await getActiveMembership(supabase, userId);
  }

  const { data: row, error } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("id", postId)
    .in("status", ["published", "hidden"])
    .maybeSingle();

  if (error) throw error;
  if (!row) {
    sendJson(res, 404, { error: "Lecture post not found." });
    return;
  }

  const accessMap = await getAccessMap(supabase, userId, [postId]);
  const access = accessMap.get(postId);
  const hasActiveMembership = !!membership;
  const canReadBody = hasActiveMembership || !!access?.is_subscribed;
  if (row.status !== "published" && !canReadBody) {
    sendJson(res, 404, { error: "Lecture post not found." });
    return;
  }

  const post = normalizePost(row, access, hasActiveMembership);
  sendJson(res, 200, {
    ok: true,
    post: canReadBody ? { ...post, body: row.body } : post,
    canReadBody,
    wallet,
    membership,
  });
}

async function handlePostRead(req, res, postId) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  if (!postId) {
    sendJson(res, 400, { error: "postId is required." });
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const { data, error } = await supabase.rpc("lecture_read_post", {
    p_user_id: authPayload.sub,
    p_post_id: postId,
    p_idempotency_key: makeIdempotencyKey(req, `lecture-read-${postId}`),
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handlePostSubscribe(req, res, postId) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  if (!postId) {
    sendJson(res, 400, { error: "postId is required." });
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const { data, error } = await supabase.rpc("lecture_subscribe_post", {
    p_user_id: authPayload.sub,
    p_post_id: postId,
    p_idempotency_key: makeIdempotencyKey(req, `lecture-subscribe-${postId}`),
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handleMemberships(req, res) {
  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  if (req.method === "GET") {
    const wallet = await ensureWallet(supabase, authPayload.sub);
    const membership = await getActiveMembership(supabase, authPayload.sub);
    sendJson(res, 200, {
      ok: true,
      plans: MEMBERSHIP_PLANS,
      wallet,
      membership,
    });
    return;
  }

  if (req.method === "POST") {
    const planKey = String(req.body?.planKey || "").trim();
    const { data, error } = await supabase.rpc("purchase_lecture_membership", {
      p_user_id: authPayload.sub,
      p_plan_key: planKey,
      p_idempotency_key: makeIdempotencyKey(req, `lecture-membership-${planKey}`),
    });

    if (error) throw error;
    sendJson(res, resultStatus(data), { ...data, plans: MEMBERSHIP_PLANS });
    return;
  }

  methodNotAllowed(res, "GET, POST");
}

async function handleCreateReport(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const postId = String(req.body?.postId || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const detail = String(req.body?.detail || "").trim();
  if (!postId || !reason) {
    sendJson(res, 400, { error: "postId and reason are required." });
    return;
  }

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
  sendJson(res, 201, { ok: true, report: data });
}

async function handleAuthorEarnings(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const { data, error } = await supabase
    .from("lecture_author_earnings")
    .select("id, author_id, post_id, payer_user_id, source, gross_points, author_points, platform_points, status, created_at")
    .eq("author_id", authPayload.sub)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  sendJson(res, 200, {
    ok: true,
    summary: summarizeEarnings(data || []),
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
  });
}

async function handleAuthorSettlements(req, res) {
  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("lecture_author_settlement_requests")
      .select("id, author_id, requested_points, status, note, admin_note, requested_at, decided_at, settled_at")
      .eq("author_id", authPayload.sub)
      .order("requested_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    sendJson(res, 200, { ok: true, settlements: data || [] });
    return;
  }

  if (req.method === "POST") {
    const { data, error } = await supabase.rpc("request_lecture_author_settlement", {
      p_author_id: authPayload.sub,
      p_note: String(req.body?.note || ""),
    });

    if (error) throw error;
    sendJson(res, resultStatus(data), data);
    return;
  }

  methodNotAllowed(res, "GET, POST");
}

async function handleAdminSummary(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  requireLectureAdmin(req);
  const supabase = getSupabase();

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

  sendJson(res, 200, {
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
  });
}

async function handleAdminCreatePost(req, res) {
  requireLectureAdmin(req);

  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const supabase = getSupabase();
  const payload = normalizePostPayload(req.body || {});

  const { data, error } = await supabase
    .from("lecture_posts")
    .insert(payload)
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .single();

  if (error) throw error;

  await supabase.from("lecture_audit_logs").insert({
    action: "lecture_post_created",
    target_type: "lecture_post",
    target_id: data.id,
    metadata: { status: data.status },
  });

  sendJson(res, 201, { ok: true, post: data });
}

async function handleAdminUpdatePost(req, res, postId) {
  requireLectureAdmin(req);

  if (!["PUT", "PATCH", "DELETE"].includes(req.method)) {
    methodNotAllowed(res, "PUT, PATCH, DELETE");
    return;
  }

  if (!postId) {
    sendJson(res, 400, { error: "postId is required." });
    return;
  }

  const supabase = getSupabase();
  const { data: existing, error: findError } = await supabase
    .from("lecture_posts")
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();

  if (findError) throw findError;
  if (!existing) {
    sendJson(res, 404, { error: "Lecture post not found." });
    return;
  }

  await supabase.from("lecture_post_revisions").insert({
    post_id: postId,
    title: existing.title,
    summary: existing.summary || "",
    body: existing.body,
  });

  const payload = req.method === "DELETE"
    ? { ...existing, status: "deleted", updated_at: new Date().toISOString() }
    : normalizeUpdatePayload(req.body || {}, existing);

  const { data, error } = await supabase
    .from("lecture_posts")
    .update(payload)
    .eq("id", postId)
    .select("id, title, summary, body, author_id, author_name, status, category, tags, read_price, subscribe_price, published_at, created_at, updated_at")
    .single();

  if (error) throw error;

  await supabase.from("lecture_audit_logs").insert({
    action: req.method === "DELETE" ? "lecture_post_deleted" : "lecture_post_updated",
    target_type: "lecture_post",
    target_id: postId,
    metadata: { status: data.status },
  });

  sendJson(res, 200, { ok: true, post: data });
}

async function handleAdminRefund(req, res) {
  requireLectureAdmin(req);

  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const transactionId = String(req.body?.transactionId || req.body?.transaction_id || "").trim();
  if (!transactionId) {
    sendJson(res, 400, { error: "transactionId is required." });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_refund_point_transaction", {
    p_actor_user_id: req.body?.actorUserId || "lecture-admin",
    p_transaction_id: transactionId,
    p_reason: String(req.body?.reason || ""),
    p_revoke_access: req.body?.revokeAccess !== false,
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handleAdminAccess(req, res) {
  requireLectureAdmin(req);

  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const userId = String(req.body?.userId || req.body?.user_id || "").trim();
  const postId = String(req.body?.postId || req.body?.post_id || "").trim();
  if (!userId || !postId) {
    sendJson(res, 400, { error: "userId and postId are required." });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_update_lecture_access", {
    p_actor_user_id: req.body?.actorUserId || "lecture-admin",
    p_user_id: userId,
    p_post_id: postId,
    p_read_count: req.body?.readCount ?? req.body?.read_count ?? null,
    p_is_subscribed: req.body?.isSubscribed ?? req.body?.is_subscribed ?? null,
    p_unlock: !!req.body?.unlock,
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handleAdminAuthors(req, res) {
  requireLectureAdmin(req);
  const supabase = getSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("lecture_author_permissions")
      .select("user_id, role, status, approved_by_user_id, approved_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    sendJson(res, 200, { ok: true, authors: data || [] });
    return;
  }

  if (req.method === "POST") {
    const userId = String(req.body?.userId || req.body?.user_id || "").trim();
    if (!userId) {
      sendJson(res, 400, { error: "userId is required." });
      return;
    }
    const role = ["writer", "editor", "admin"].includes(req.body?.role) ? req.body.role : "writer";
    const status = ["active", "suspended"].includes(req.body?.status) ? req.body.status : "active";

    const { data, error } = await supabase
      .from("lecture_author_permissions")
      .upsert({
        user_id: userId,
        role,
        status,
        approved_by_user_id: req.body?.actorUserId || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("user_id, role, status, approved_by_user_id, approved_at, updated_at")
      .single();
    if (error) throw error;

    await supabase.from("lecture_audit_logs").insert({
      actor_user_id: req.body?.actorUserId || null,
      action: "lecture_author_permission_updated",
      target_type: "lecture_author_permission",
      target_id: userId,
      metadata: { role, status },
    });

    sendJson(res, 200, { ok: true, author: data });
    return;
  }

  methodNotAllowed(res, "GET, POST");
}

async function handleAdminReport(req, res, reportId) {
  requireLectureAdmin(req);

  if (!["PUT", "PATCH"].includes(req.method)) {
    methodNotAllowed(res, "PUT, PATCH");
    return;
  }

  const status = String(req.body?.status || "").trim();
  if (!reportId || !["open", "reviewing", "resolved", "rejected"].includes(status)) {
    sendJson(res, 400, { error: "Valid reportId and status are required." });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("lecture_content_reports")
    .update({
      status,
      admin_note: String(req.body?.adminNote || req.body?.admin_note || ""),
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

  sendJson(res, 200, { ok: true, report: data });
}

async function handleAdminSettlement(req, res, requestId) {
  requireLectureAdmin(req);

  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  if (!requestId) {
    sendJson(res, 400, { error: "requestId is required." });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_settle_lecture_author_request", {
    p_actor_user_id: req.body?.actorUserId || "lecture-admin",
    p_request_id: requestId,
    p_admin_note: String(req.body?.adminNote || req.body?.admin_note || ""),
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handleAdmin(req, res, segments) {
  const [, route, id] = segments;

  if (route === "summary") {
    await handleAdminSummary(req, res);
    return;
  }

  if (route === "posts" && !id) {
    await handleAdminCreatePost(req, res);
    return;
  }

  if (route === "posts" && id) {
    await handleAdminUpdatePost(req, res, id);
    return;
  }

  if (route === "refund") {
    await handleAdminRefund(req, res);
    return;
  }

  if (route === "access") {
    await handleAdminAccess(req, res);
    return;
  }

  if (route === "authors") {
    await handleAdminAuthors(req, res);
    return;
  }

  if (route === "reports" && id) {
    await handleAdminReport(req, res, id);
    return;
  }

  if (route === "settlements" && id) {
    await handleAdminSettlement(req, res, id);
    return;
  }

  sendJson(res, 404, { error: "Lecture admin route not found." });
}

async function handlePosts(req, res, segments) {
  const [, postId, action] = segments;

  if (!postId) {
    await handlePostList(req, res);
    return;
  }

  if (!action) {
    await handlePostDetail(req, res, postId);
    return;
  }

  if (action === "read") {
    await handlePostRead(req, res, postId);
    return;
  }

  if (action === "subscribe") {
    await handlePostSubscribe(req, res, postId);
    return;
  }

  sendJson(res, 404, { error: "Lecture post route not found." });
}

async function handleAuthor(req, res, segments) {
  const [, route] = segments;

  if (route === "earnings") {
    await handleAuthorEarnings(req, res);
    return;
  }

  if (route === "settlements") {
    await handleAuthorSettlements(req, res);
    return;
  }

  sendJson(res, 404, { error: "Lecture author route not found." });
}

export default async function handler(req, res) {
  try {
    const segments = routeSegments(req);
    const [route] = segments;

    if (route === "posts") {
      await handlePosts(req, res, segments);
      return;
    }

    if (route === "memberships") {
      await handleMemberships(req, res);
      return;
    }

    if (route === "reports") {
      await handleCreateReport(req, res);
      return;
    }

    if (route === "author") {
      await handleAuthor(req, res, segments);
      return;
    }

    if (route === "admin") {
      await handleAdmin(req, res, segments);
      return;
    }

    sendJson(res, 404, { error: "Lecture route not found." });
  } catch (error) {
    sendError(res, error);
  }
}

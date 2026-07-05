import { requireAuth } from "./_auth.js";
import { getSupabase, sendError, sendJson } from "./_supabase.js";
import {
  ensureProfile,
  ensureWallet,
  makeIdempotencyKey,
  resultStatus,
} from "./lecture/_shared.js";

const ALLOWED_TYPES = new Set([
  "earn",
  "spend",
  "bonus",
  "penalty",
  "virtue_spend",
  "adjustment",
]);

function routeSegments(req) {
  const requestUrl = new URL(req.url || "/api/points", `https://${req.headers.host || "localhost"}`);
  const value = req.query.path ?? requestUrl.searchParams.get("path");
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split("/").filter(Boolean);
  return requestUrl.pathname.replace(/^\/api\/points\/?/, "").split("/").filter(Boolean);
}

function methodNotAllowed(res, allow) {
  res.setHeader("Allow", allow);
  sendJson(res, 405, { error: "Method not allowed." });
}

function normalizeType(value) {
  const type = String(value || "adjustment").trim().replace("virtue-spend", "virtue_spend");
  return ALLOWED_TYPES.has(type) ? type : "adjustment";
}

async function handleWallet(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);
  const wallet = await ensureWallet(supabase, authPayload.sub);

  const { data, error } = await supabase
    .from("point_transactions")
    .select("id, amount, balance_after, type, description, ref_type, ref_id, metadata, created_at")
    .eq("user_id", authPayload.sub)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  sendJson(res, 200, {
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
  });
}

async function handleCharge(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const amount = Math.floor(Number(req.body?.amount || 0));
  if (!Number.isFinite(amount) || amount < 1000) {
    sendJson(res, 400, { error: "Charge amount must be at least 1,000 points." });
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const { data, error } = await supabase.rpc("credit_points", {
    p_user_id: authPayload.sub,
    p_amount: amount,
    p_description: "Point charge",
    p_idempotency_key: makeIdempotencyKey(req, `point-charge-${amount}`),
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

async function handleTransaction(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  const amount = Math.trunc(Number(req.body?.amount || 0));
  if (!Number.isFinite(amount) || amount === 0) {
    sendJson(res, 400, { error: "Point transaction amount must not be zero." });
    return;
  }

  const authPayload = await requireAuth(req);
  const supabase = getSupabase();
  await ensureProfile(supabase, authPayload);

  const type = normalizeType(req.body?.type);
  const { data, error } = await supabase.rpc("record_point_transaction", {
    p_user_id: authPayload.sub,
    p_amount: amount,
    p_type: type,
    p_description: String(req.body?.description || "Point transaction").slice(0, 200),
    p_ref_type: String(req.body?.refType || "app_activity").slice(0, 80),
    p_ref_id: String(req.body?.refId || type).slice(0, 160),
    p_metadata: req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {},
    p_idempotency_key: makeIdempotencyKey(req, `point-${type}-${Math.abs(amount)}`),
  });

  if (error) throw error;
  sendJson(res, resultStatus(data), data);
}

export default async function handler(req, res) {
  try {
    const [route] = routeSegments(req);

    if (route === "wallet") {
      await handleWallet(req, res);
      return;
    }

    if (route === "charge") {
      await handleCharge(req, res);
      return;
    }

    if (route === "transaction") {
      await handleTransaction(req, res);
      return;
    }

    sendJson(res, 404, { error: "Point API route not found." });
  } catch (error) {
    sendError(res, error);
  }
}

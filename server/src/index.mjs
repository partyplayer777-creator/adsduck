import express from "express";
import cors from "cors";
import { config, validateConfig } from "./config.mjs";
import { optionalAuth, requireAuth } from "./lib/authToken.mjs";
import { assertSupabaseReady } from "./lib/supabase.mjs";
import { applyMetricUpdates } from "./services/socialMetrics.mjs";
import { createCheckoutSession } from "./services/paymentKit.mjs";
import {
  createContestPrizePayout,
  createOrganizerPaymentCode,
  getOrganizerPaymentCode,
} from "./services/organizerPayments.mjs";
import {
  createLectureAdminPost,
  createLectureReport,
  getLectureAuthorEarnings,
  getAuthorSettlements,
  getLectureAdminSummary,
  getLectureMemberships,
  getLecturePost,
  getPointWallet,
  listLecturePosts,
  makeIdempotencyKey,
  purchaseLectureMembership,
  readLecturePost,
  recordPointTransaction,
  refundLectureTransaction,
  requestAuthorSettlement,
  resultStatus,
  settleAuthorRequest,
  subscribeLecturePost,
  updateLectureAccess,
  updateLectureAdminPost,
  updateLectureAuthorPermission,
  updateLectureReport,
} from "./services/lectureLetters.mjs";
import { startPassOrganizerVerification, verifyBusinessOrganizer } from "./services/organizerVerification.mjs";
import { getLeaderboard, joinContest, submitEntry } from "./services/leaderboard.mjs";

const missing = validateConfig();
if (missing.length > 0) {
  console.warn(`[config] Missing env: ${missing.join(", ")}. API will fail until configured.`);
}

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(optionalAuth);

function requireLectureAdmin(req, res, next) {
  const expected = String(config.lectureAdminSecret || config.organizerPaymentCodeAdminSecret || "").trim();
  const presented = String(req.headers["x-lecture-admin-secret"] || req.headers["x-admin-secret"] || "").trim();
  if (!expected || presented !== expected) {
    res.status(403).json({ error: "Lecture admin authorization required." });
    return;
  }
  next();
}

app.get("/health/live", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await assertSupabaseReady();
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  res.json({ user: { id: req.auth.sub, audience: req.auth.aud } });
});

app.get("/api/points/wallet", requireAuth, async (req, res, next) => {
  try {
    res.json(await getPointWallet(req.auth));
  } catch (error) {
    next(error);
  }
});

app.post("/api/points/charge", requireAuth, async (req, res, next) => {
  try {
    res.status(403).json({ error: "Point charging is currently disabled." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/points/transaction", requireAuth, async (req, res, next) => {
  try {
    const amount = Math.trunc(Number(req.body?.amount || 0));
    if (!Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ error: "Point transaction amount must not be zero." });
      return;
    }

    const type = String(req.body?.type || "adjustment").replace("virtue-spend", "virtue_spend");
    const result = await recordPointTransaction(
      req.auth,
      req.body,
      makeIdempotencyKey(req, `point-${type}-${Math.abs(amount)}`)
    );
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/posts", async (req, res, next) => {
  try {
    res.json(await listLecturePosts(req.auth));
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/posts/:postId", async (req, res, next) => {
  try {
    res.json(await getLecturePost(req.params.postId, req.auth));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/posts/:postId/read", requireAuth, async (req, res, next) => {
  try {
    const result = await readLecturePost(
      req.params.postId,
      req.auth,
      makeIdempotencyKey(req, `lecture-read-${req.params.postId}`)
    );
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/posts/:postId/subscribe", requireAuth, async (req, res, next) => {
  try {
    const result = await subscribeLecturePost(
      req.params.postId,
      req.auth,
      makeIdempotencyKey(req, `lecture-subscribe-${req.params.postId}`)
    );
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/memberships", requireAuth, async (req, res, next) => {
  try {
    res.json(await getLectureMemberships(req.auth));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/memberships", requireAuth, async (req, res, next) => {
  try {
    const planKey = String(req.body?.planKey || "").trim();
    const result = await purchaseLectureMembership(
      req.auth,
      planKey,
      makeIdempotencyKey(req, `lecture-membership-${planKey}`)
    );
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/author/earnings", requireAuth, async (req, res, next) => {
  try {
    res.json(await getLectureAuthorEarnings(req.auth));
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/author/settlements", requireAuth, async (req, res, next) => {
  try {
    res.json(await getAuthorSettlements(req.auth));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/author/settlements", requireAuth, async (req, res, next) => {
  try {
    const result = await requestAuthorSettlement(req.auth, req.body?.note);
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/reports", requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await createLectureReport(req.auth, req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/lecture/admin/summary", requireLectureAdmin, async (_req, res, next) => {
  try {
    res.json(await getLectureAdminSummary());
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/admin/posts", requireLectureAdmin, async (req, res, next) => {
  try {
    res.status(201).json(await createLectureAdminPost(req.body));
  } catch (error) {
    next(error);
  }
});

app.put("/api/lecture/admin/posts/:postId", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureAdminPost(req.params.postId, req.body));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/lecture/admin/posts/:postId", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureAdminPost(req.params.postId, req.body));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lecture/admin/posts/:postId", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureAdminPost(req.params.postId, {}, { deleted: true }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/admin/refund", requireLectureAdmin, async (req, res, next) => {
  try {
    const result = await refundLectureTransaction({
      actorUserId: req.body?.actorUserId || "lecture-admin",
      transactionId: req.body?.transactionId || req.body?.transaction_id,
      reason: req.body?.reason || "",
      revokeAccess: req.body?.revokeAccess !== false,
    });
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/admin/access", requireLectureAdmin, async (req, res, next) => {
  try {
    const result = await updateLectureAccess({
      actorUserId: req.body?.actorUserId || "lecture-admin",
      userId: req.body?.userId || req.body?.user_id,
      postId: req.body?.postId || req.body?.post_id,
      readCount: req.body?.readCount ?? req.body?.read_count ?? null,
      isSubscribed: req.body?.isSubscribed ?? req.body?.is_subscribed ?? null,
      unlock: !!req.body?.unlock,
    });
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/admin/authors", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureAuthorPermission(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/lecture/admin/reports/:reportId", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureReport(req.params.reportId, req.body));
  } catch (error) {
    next(error);
  }
});

app.put("/api/lecture/admin/reports/:reportId", requireLectureAdmin, async (req, res, next) => {
  try {
    res.json(await updateLectureReport(req.params.reportId, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecture/admin/settlements/:requestId", requireLectureAdmin, async (req, res, next) => {
  try {
    const result = await settleAuthorRequest({
      actorUserId: req.body?.actorUserId || "lecture-admin",
      requestId: req.params.requestId,
      adminNote: req.body?.adminNote || req.body?.admin_note || "",
    });
    res.status(resultStatus(result)).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/contests/:contestId/leaderboard", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getLeaderboard(req.params.contestId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/contests/:contestId/leaderboard/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const push = async () => {
    if (closed) return;
    try {
      const data = await getLeaderboard(req.params.contestId);
      res.write(`event: leaderboard\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  await push();
  const interval = setInterval(push, config.leaderboardStreamIntervalMs);
  req.on("close", () => clearInterval(interval));
});

app.post("/api/contests/:contestId/participations", requireAuth, async (req, res, next) => {
  try {
    const participation = await joinContest({
      contestId: req.params.contestId,
      authPayload: req.auth,
      profilePayload: req.body?.profile || null,
    });
    res.json({ ok: true, participation });
  } catch (error) {
    next(error);
  }
});

app.post("/api/contests/:contestId/entries", requireAuth, async (req, res, next) => {
  try {
    const { platform, snsUrl, title, profile } = req.body || {};
    if (!platform || !snsUrl) {
      res.status(400).json({ error: "platform and snsUrl are required." });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(snsUrl);
    } catch {
      res.status(400).json({ error: "snsUrl must be a valid URL." });
      return;
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: "snsUrl must be a valid URL." });
      return;
    }

    const entry = await submitEntry({
      contestId: req.params.contestId,
      authPayload: req.auth,
      payload: { platform, snsUrl, title, profile },
    });
    res.json({ ok: true, entry });
  } catch (error) {
    next(error);
  }
});

app.post("/api/organizer/verification/business", async (req, res, next) => {
  try {
    res.json(await verifyBusinessOrganizer(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/organizer/verification/pass/start", async (req, res, next) => {
  try {
    res.json(await startPassOrganizerVerification({
      user: req.auth,
      returnUrl: req.body?.returnUrl || `${config.webOrigin}/?organizer=1`,
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/organizer/payment-codes/verify", async (req, res, next) => {
  try {
    const paymentCode = await getOrganizerPaymentCode(req.body?.code);
    res.json({ ok: true, paymentCode });
  } catch (error) {
    next(error);
  }
});

app.post("/api/organizer/payment-codes/checkout", async (req, res, next) => {
  try {
    const paymentCode = await getOrganizerPaymentCode(req.body?.code);
    const checkout = await createCheckoutSession({
      productId: paymentCode.productId,
      user: req.auth,
      returnUrl: `${config.webOrigin}/payment-return?organizer=1&code=${encodeURIComponent(paymentCode.code)}`,
      context: {
        paymentCode: paymentCode.code,
        totalAmount: paymentCode.totalAmount,
        serviceFeeAmount: paymentCode.serviceFeeAmount,
        escrowAmount: paymentCode.escrowAmount,
        recognizedRevenueAmount: paymentCode.recognizedRevenueAmount,
        prizeExpenseAmount: paymentCode.prizeExpenseAmount,
        prizeOffsetAmount: paymentCode.prizeOffsetAmount,
        creatorPayoutIncomeType: paymentCode.creatorPayoutIncomeType,
        creatorPayoutWithholdingTaxRate: paymentCode.creatorPayoutWithholdingTaxRate,
      },
    });
    res.json({ ...checkout, paymentCode });
  } catch (error) {
    next(error);
  }
});

app.post("/api/internal/organizer/payment-codes", async (req, res, next) => {
  try {
    if (
      !config.organizerPaymentCodeAdminSecret ||
      req.headers["x-payment-code-secret"] !== config.organizerPaymentCodeAdminSecret
    ) {
      res.status(403).json({ error: "Invalid payment code secret." });
      return;
    }

    const paymentCode = await createOrganizerPaymentCode({
      totalAmount: req.body?.totalAmount,
      label: req.body?.label,
      expiresAt: req.body?.expiresAt,
    });
    res.json({ ok: true, paymentCode });
  } catch (error) {
    next(error);
  }
});

app.post("/api/internal/organizer/prize-payouts", async (req, res, next) => {
  try {
    if (
      !config.organizerPaymentCodeAdminSecret ||
      req.headers["x-payment-code-secret"] !== config.organizerPaymentCodeAdminSecret
    ) {
      res.status(403).json({ error: "Invalid payment code secret." });
      return;
    }

    const payout = await createContestPrizePayout({
      contestId: req.body?.contestId,
      userId: req.body?.userId,
      entryId: req.body?.entryId,
      paymentCode: req.body?.paymentCode,
      grossAmount: req.body?.grossAmount,
      note: req.body?.note,
    });
    res.json({ ok: true, payout });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/checkout", requireAuth, async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    if (!productId) {
      res.status(400).json({ error: "productId is required." });
      return;
    }

    const checkout = await createCheckoutSession({
      productId,
      user: req.auth,
      returnUrl: `${config.webOrigin}/payment-return`,
    });
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});

app.post("/api/internal/social-metrics/sync", async (req, res, next) => {
  try {
    if (!config.metricsSyncSecret || req.headers["x-sync-secret"] !== config.metricsSyncSecret) {
      res.status(403).json({ error: "Invalid sync secret." });
      return;
    }

    const results = await applyMetricUpdates(req.body?.updates);
    res.json({ ok: true, updated: results.length });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error("[api]", error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "Internal Server Error",
  });
});

app.listen(config.port, () => {
  console.log(`AdsDuck API listening on ${config.publicBaseUrl}`);
});

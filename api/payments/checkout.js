import { requireAuth } from "../_auth.js";
import { createCheckoutSession, getRequestOrigin } from "../_paymentKit.js";

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { error: status >= 500 ? "Internal Server Error" : error.message });
  if (status >= 500) console.error("[api/payments/checkout]", error);
}

function parsePointAmount(value) {
  const amount = Math.floor(Number(value || 0));
  if (!Number.isFinite(amount) || amount < 1000) {
    const error = new Error("Point charge amount must be at least 1000.");
    error.status = 400;
    throw error;
  }
  if (amount % 100 !== 0) {
    const error = new Error("Point charge amount must be in 100 KRW units.");
    error.status = 400;
    throw error;
  }
  return amount;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const authPayload = await requireAuth(req);
    const body = req.body || {};
    const kind = body.kind || body.type || "product";
    const origin = getRequestOrigin(req);

    if (kind === "point-charge") {
      const amount = parsePointAmount(body.amount);
      const productId = body.productId || `adsduck-point-charge-${amount}`;
      const checkout = await createCheckoutSession({
        productId,
        user: authPayload,
        returnUrl: `${origin}/?points=1&checkout=return`,
        context: {
          paymentKind: "point-charge",
          amount,
          points: amount,
          conversionRate: "1KRW=1P",
        },
      });
      sendJson(res, 200, { ...checkout, ok: true, productId, amount, points: amount });
      return;
    }

    const productId = String(body.productId || "").trim();
    if (!productId) {
      sendJson(res, 400, { error: "productId is required." });
      return;
    }

    const checkout = await createCheckoutSession({
      productId,
      user: authPayload,
      returnUrl: `${origin}/payment-return`,
      context: body.context || {},
    });
    sendJson(res, 200, { ...checkout, ok: true, productId });
  } catch (error) {
    sendError(res, error);
  }
}

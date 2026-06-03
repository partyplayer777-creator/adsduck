import { verifyAccessToken } from "../../_auth.js";
import { createCheckoutSession, getRequestOrigin } from "../../_paymentKit.js";
import { getOrganizerPaymentCode, sendError, sendJson } from "./_shared.js";

function optionalAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const paymentCode = await getOrganizerPaymentCode(req.body?.code);
    const origin = getRequestOrigin(req);
    const checkout = await createCheckoutSession({
      productId: paymentCode.productId,
      user: optionalAuth(req),
      returnUrl: `${origin}/payment-return?organizer=1&code=${encodeURIComponent(paymentCode.code)}`,
      context: {
        paymentKind: "organizer-contest",
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

    sendJson(res, 200, { ...checkout, ok: true, paymentCode });
  } catch (error) {
    sendError(res, error);
  }
}

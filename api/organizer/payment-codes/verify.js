import { getOrganizerPaymentCode, sendError, sendJson } from "./_shared.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const paymentCode = await getOrganizerPaymentCode(req.body?.code);
    sendJson(res, 200, { ok: true, paymentCode });
  } catch (error) {
    sendError(res, error);
  }
}

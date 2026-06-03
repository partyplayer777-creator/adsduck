import { config } from "../config.mjs";

export async function createCheckoutSession({ productId, user, returnUrl, context = {} }) {
  if (!config.paymentKit.baseUrl) {
    throw new Error("PAYMENT_KIT_BASE_URL is not configured.");
  }

  const response = await fetch(`${config.paymentKit.baseUrl}/api/payment-kit/web/create-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectKey: config.paymentKit.projectKey,
      productId,
      returnUrl,
      context: {
        ...context,
        userId: user?.sub || context.userId || "organizer-guest",
        customerName: user?.display_name || user?.sub || context.customerName || "organizer-guest",
        customerEmail: user?.email || context.customerEmail || "",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Failed to create payment session.");
  }

  return data;
}

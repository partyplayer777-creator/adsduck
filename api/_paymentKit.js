export function getRequestOrigin(req) {
  const configuredOrigin = String(process.env.WEB_ORIGIN || "").replace(/\/$/, "");
  if (configuredOrigin) return configuredOrigin;

  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "https://adsduck.com";
}

export async function createCheckoutSession({ productId, user, returnUrl, context = {} }) {
  const baseUrl = String(process.env.PAYMENT_KIT_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    const error = new Error("PAYMENT_KIT_BASE_URL is not configured.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${baseUrl}/api/payment-kit/web/create-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectKey: process.env.PAYMENT_KIT_PROJECT_KEY || "adsduck",
      productId,
      returnUrl,
      context: {
        ...context,
        userId: user?.sub || context.userId || "adsduck-user",
        customerName: user?.display_name || user?.name || user?.sub || context.customerName || "adsduck-user",
        customerEmail: user?.email || context.customerEmail || "",
      },
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || "Failed to create payment session.");
    error.status = response.status || 502;
    throw error;
  }

  return data;
}

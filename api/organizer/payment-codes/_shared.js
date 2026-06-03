import { getSupabase } from "../../_supabase.js";
import {
  calculateOrganizerPayment,
  findOrganizerPaymentCode,
  normalizePaymentCode,
} from "../../../src/data/organizerPaymentCodes.js";

function makeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { error: status >= 500 ? "Internal Server Error" : error.message });
  if (status >= 500) console.error("[api/organizer/payment-codes]", error);
}

function serializePaymentCode(row) {
  const totalAmount = Number(row.total_amount ?? row.totalAmount ?? 0);
  return {
    code: normalizePaymentCode(row.code),
    label: row.label || `${totalAmount.toLocaleString()}원 공모전 주최 결제 코드`,
    productId: row.product_id || row.productId || `contest-host-${totalAmount}`,
    status: row.status || "active",
    expiresAt: row.expires_at || row.expiresAt || null,
    ...calculateOrganizerPayment(totalAmount),
  };
}

async function fetchStoredPaymentCode(code) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("organizer_payment_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) throw error;
    return data ? serializePaymentCode(data) : null;
  } catch (error) {
    const message = String(error.message || "");
    if (
      error.status === 503 ||
      message.includes("Supabase is not configured") ||
      message.includes("organizer_payment_codes") ||
      message.includes("does not exist")
    ) {
      return null;
    }
    throw error;
  }
}

export async function getOrganizerPaymentCode(inputCode) {
  const code = normalizePaymentCode(inputCode);
  if (!code) throw makeError(400, "code is required.");

  const paymentCode = (await fetchStoredPaymentCode(code)) || findOrganizerPaymentCode(code);
  if (!paymentCode) throw makeError(404, "Invalid payment code.");
  if (paymentCode.status !== "active") throw makeError(409, "Payment code is not active.");
  if (paymentCode.expiresAt && new Date(paymentCode.expiresAt).getTime() <= Date.now()) {
    throw makeError(410, "Payment code has expired.");
  }

  return paymentCode;
}

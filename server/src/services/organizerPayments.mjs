import crypto from "node:crypto";
import { supabase } from "../lib/supabase.mjs";

export const CREATOR_PAYOUT_INCOME_TYPE = "personal_service_business_income";
export const CREATOR_PAYOUT_INCOME_TAX_RATE = 0.03;
export const CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE = 0.003;
export const CREATOR_PAYOUT_WITHHOLDING_TAX_RATE =
  CREATOR_PAYOUT_INCOME_TAX_RATE + CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE;

const FALLBACK_PAYMENT_CODES = [
  {
    code: "ADSDUCK-500K",
    label: "50만원 공모전 주최 결제 코드",
    total_amount: 500000,
    product_id: "contest-host-500000",
    status: "active",
    expires_at: "2026-12-31T14:59:59.000Z",
  },
  {
    code: "ADSDUCK-1000K",
    label: "100만원 공모전 주최 결제 코드",
    total_amount: 1000000,
    product_id: "contest-host-1000000",
    status: "active",
    expires_at: "2026-12-31T14:59:59.000Z",
  },
];

function makeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizePaymentCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function calculateOrganizerPayment(totalAmount) {
  const amount = Math.max(0, Number(totalAmount) || 0);
  const serviceFeeAmount = Math.floor(amount * 0.2);
  const escrowAmount = amount - serviceFeeAmount;

  return {
    totalAmount: amount,
    serviceFeeAmount,
    escrowAmount,
    recognizedRevenueAmount: amount,
    prizeExpenseAmount: escrowAmount,
    prizeOffsetAmount: escrowAmount,
    creatorPayoutIncomeType: CREATOR_PAYOUT_INCOME_TYPE,
    creatorPayoutIncomeTaxRate: CREATOR_PAYOUT_INCOME_TAX_RATE,
    creatorPayoutLocalIncomeTaxRate: CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE,
    creatorPayoutWithholdingTaxRate: CREATOR_PAYOUT_WITHHOLDING_TAX_RATE,
  };
}

export function calculateCreatorPayout(grossAmount) {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const incomeTaxAmount = Math.floor(gross * CREATOR_PAYOUT_INCOME_TAX_RATE);
  const localIncomeTaxAmount = Math.floor(gross * CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE);
  const withholdingTaxAmount = incomeTaxAmount + localIncomeTaxAmount;

  return {
    grossAmount: gross,
    incomeType: CREATOR_PAYOUT_INCOME_TYPE,
    incomeTaxAmount,
    localIncomeTaxAmount,
    withholdingTaxAmount,
    netAmount: gross - withholdingTaxAmount,
  };
}

function serializePaymentCode(row) {
  const totalAmount = Number(row.total_amount ?? row.totalAmount ?? 0);
  const amounts = calculateOrganizerPayment(totalAmount);

  return {
    code: normalizePaymentCode(row.code),
    label: row.label || `${totalAmount.toLocaleString()}원 공모전 주최 결제 코드`,
    productId: row.product_id || row.productId || `contest-host-${totalAmount}`,
    status: row.status || "active",
    expiresAt: row.expires_at || row.expiresAt || null,
    ...amounts,
  };
}

function fallbackPaymentCode(code) {
  const row = FALLBACK_PAYMENT_CODES.find((item) => item.code === code);
  return row ? serializePaymentCode(row) : null;
}

async function fetchStoredPaymentCode(code) {
  try {
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

  const paymentCode = (await fetchStoredPaymentCode(code)) || fallbackPaymentCode(code);
  if (!paymentCode) throw makeError(404, "Invalid payment code.");

  if (paymentCode.status !== "active") {
    throw makeError(409, "Payment code is not active.");
  }

  if (paymentCode.expiresAt && new Date(paymentCode.expiresAt).getTime() <= Date.now()) {
    throw makeError(410, "Payment code has expired.");
  }

  return paymentCode;
}

export async function createOrganizerPaymentCode({ totalAmount, label, expiresAt }) {
  const amount = Number(totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeError(400, "totalAmount must be a positive number.");
  }

  const code = `ADSDUCK-${Math.round(amount / 1000)}K-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const amounts = calculateOrganizerPayment(amount);
  const record = {
    code,
    label: label || `${amount.toLocaleString()}원 공모전 주최 결제 코드`,
    total_amount: amounts.totalAmount,
    service_fee_amount: amounts.serviceFeeAmount,
    escrow_amount: amounts.escrowAmount,
    recognized_revenue_amount: amounts.recognizedRevenueAmount,
    prize_expense_amount: amounts.prizeExpenseAmount,
    prize_offset_amount: amounts.prizeOffsetAmount,
    creator_payout_income_type: amounts.creatorPayoutIncomeType,
    creator_payout_withholding_tax_rate: amounts.creatorPayoutWithholdingTaxRate,
    product_id: `contest-host-${amounts.totalAmount}`,
    status: "active",
    expires_at: expiresAt || null,
  };

  try {
    const { data, error } = await supabase
      .from("organizer_payment_codes")
      .insert(record)
      .select("*")
      .single();

    if (error) throw error;
    return serializePaymentCode(data);
  } catch (error) {
    const message = String(error.message || "");
    if (
      error.status === 503 ||
      message.includes("Supabase is not configured") ||
      message.includes("organizer_payment_codes") ||
      message.includes("does not exist")
    ) {
      return {
        ...serializePaymentCode(record),
        mode: "preview",
      };
    }
    throw error;
  }
}

export async function createContestPrizePayout({
  contestId,
  userId,
  grossAmount,
  paymentCode = null,
  entryId = null,
  note = null,
}) {
  if (!contestId) throw makeError(400, "contestId is required.");
  if (!userId) throw makeError(400, "userId is required.");

  const payout = calculateCreatorPayout(grossAmount);
  if (payout.grossAmount <= 0) {
    throw makeError(400, "grossAmount must be a positive number.");
  }

  const record = {
    contest_id: String(contestId),
    user_id: String(userId),
    entry_id: entryId || null,
    payment_code: paymentCode ? normalizePaymentCode(paymentCode) : null,
    gross_amount: payout.grossAmount,
    income_type: payout.incomeType,
    income_tax_amount: payout.incomeTaxAmount,
    local_income_tax_amount: payout.localIncomeTaxAmount,
    withholding_tax_amount: payout.withholdingTaxAmount,
    net_amount: payout.netAmount,
    note,
    status: "pending",
  };

  try {
    const { data, error } = await supabase
      .from("contest_prize_payouts")
      .insert(record)
      .select("*")
      .single();

    if (error) throw error;
    return { ...payout, id: data.id, status: data.status };
  } catch (error) {
    const message = String(error.message || "");
    if (
      error.status === 503 ||
      message.includes("Supabase is not configured") ||
      message.includes("contest_prize_payouts") ||
      message.includes("does not exist")
    ) {
      return {
        ...payout,
        mode: "preview",
        status: "pending",
      };
    }
    throw error;
  }
}

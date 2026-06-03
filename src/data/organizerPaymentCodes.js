export const ORGANIZER_CONTACT_URL = "https://open.kakao.com/o/sW7KjCxi";
export const CREATOR_PAYOUT_INCOME_TYPE = "personal_service_business_income";
export const CREATOR_PAYOUT_INCOME_TAX_RATE = 0.03;
export const CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE = 0.003;
export const CREATOR_PAYOUT_WITHHOLDING_TAX_RATE =
  CREATOR_PAYOUT_INCOME_TAX_RATE + CREATOR_PAYOUT_LOCAL_INCOME_TAX_RATE;

export const ORGANIZER_PAYMENT_CODES = [
  {
    code: "ADSDUCK-500K",
    label: "50만원 공모전 주최 결제 코드",
    totalAmount: 500000,
    productId: "contest-host-500000",
    status: "active",
    expiresAt: "2026-12-31T14:59:59.000Z",
  },
  {
    code: "ADSDUCK-1000K",
    label: "100만원 공모전 주최 결제 코드",
    totalAmount: 1000000,
    productId: "contest-host-1000000",
    status: "active",
    expiresAt: "2026-12-31T14:59:59.000Z",
  },
];

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

export function formatKrw(amount) {
  return `${Number(amount || 0).toLocaleString()}원`;
}

export function findOrganizerPaymentCode(value) {
  const code = normalizePaymentCode(value);
  const found = ORGANIZER_PAYMENT_CODES.find((item) => item.code === code);
  if (!found) return null;
  return {
    ...found,
    ...calculateOrganizerPayment(found.totalAmount),
  };
}

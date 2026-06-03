import { config } from "../config.mjs";

function makeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function verifyBusinessOrganizer(payload = {}) {
  if (!config.businessVerification.serviceKey) {
    throw makeError(503, "NTS_BUSINESS_SERVICE_KEY is not configured.");
  }

  const businessNumber = onlyDigits(payload.businessNumber);
  const startDate = onlyDigits(payload.startDate);
  const representativeName = String(payload.representativeName || "").trim();
  const businessName = String(payload.businessName || "").trim();

  if (businessNumber.length !== 10) {
    throw makeError(400, "businessNumber must be 10 digits.");
  }
  if (startDate.length !== 8) {
    throw makeError(400, "startDate must be YYYYMMDD.");
  }
  if (!representativeName) {
    throw makeError(400, "representativeName is required.");
  }

  const url = new URL("/api/nts-businessman/v1/validate", config.businessVerification.baseUrl);
  url.searchParams.set("serviceKey", config.businessVerification.serviceKey);
  url.searchParams.set("returnType", "JSON");

  const body = {
    businesses: [
      {
        b_no: businessNumber,
        start_dt: startDate,
        p_nm: representativeName,
        ...(businessName ? { b_nm: businessName } : {}),
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    throw makeError(response.status, data?.message || data?.error || "Business verification failed.");
  }

  const item = data?.data?.[0] || {};
  const valid = item.valid === "01";

  return {
    ok: valid,
    verification: valid
      ? {
          type: "business",
          label: `사업자 ${businessNumber.slice(0, 3)}-${businessNumber.slice(3, 5)}-${businessNumber.slice(5)}`,
          status: item.status || null,
        }
      : null,
    message: valid
      ? "사업자 확인이 완료되었습니다."
      : item.valid_msg || "사업자 정보가 일치하지 않습니다.",
    raw: {
      statusCode: data.status_code,
      requestCount: data.request_cnt,
      validCount: data.valid_cnt,
    },
  };
}

export async function startPassOrganizerVerification({ user, returnUrl }) {
  if (!config.passVerification.startUrl) {
    throw makeError(501, "PASS_VERIFICATION_START_URL is not configured.");
  }

  const response = await fetch(config.passVerification.startUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: config.passVerification.clientId,
      returnUrl,
      context: {
        purpose: "adsduck-organizer-verification",
        userId: user?.sub || null,
        email: user?.email || "",
      },
    }),
  });

  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    throw makeError(response.status, data?.message || data?.error || "PASS verification failed.");
  }

  return data;
}

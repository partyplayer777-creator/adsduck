function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { error: status >= 500 ? "Internal Server Error" : error.message });
  if (status >= 500) console.error("[api/organizer/verification/business]", error);
}

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

async function verifyBusinessOrganizer(payload = {}) {
  const serviceKey = String(process.env.NTS_BUSINESS_SERVICE_KEY || "").trim();
  if (!serviceKey) {
    throw makeError(503, "NTS_BUSINESS_SERVICE_KEY is not configured.");
  }

  const businessNumber = onlyDigits(payload.businessNumber);
  const startDate = onlyDigits(payload.startDate);
  const representativeName = String(payload.representativeName || "").trim();
  const businessName = String(payload.businessName || "").trim();

  if (businessNumber.length !== 10) throw makeError(400, "businessNumber must be 10 digits.");
  if (startDate.length !== 8) throw makeError(400, "startDate must be YYYYMMDD.");
  if (!representativeName) throw makeError(400, "representativeName is required.");

  const baseUrl = String(process.env.NTS_BUSINESS_API_BASE_URL || "https://api.odcloud.kr").trim().replace(/\/$/, "");
  const url = new URL("/api/nts-businessman/v1/validate", baseUrl);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("returnType", "JSON");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      businesses: [
        {
          b_no: businessNumber,
          start_dt: startDate,
          p_nm: representativeName,
          ...(businessName ? { b_nm: businessName } : {}),
        },
      ],
    }),
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
    message: valid ? "사업자 확인이 완료되었습니다." : item.valid_msg || "사업자 정보가 일치하지 않습니다.",
    raw: {
      statusCode: data.status_code,
      requestCount: data.request_cnt,
      validCount: data.valid_cnt,
    },
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    sendJson(res, 200, await verifyBusinessOrganizer(req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

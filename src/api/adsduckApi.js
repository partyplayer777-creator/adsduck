import { appConfig } from "../config/appConfig";
import {
  calculateOrganizerPayment,
  findOrganizerPaymentCode,
  normalizePaymentCode,
} from "../data/organizerPaymentCodes";

const MOCK_ENTRIES_KEY = "adsduck-mock-contest-entries";
const USE_LOCAL_MOCKS = !appConfig.apiBaseUrl && !import.meta.env.PROD;

function getStoredMockEntries() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_ENTRIES_KEY) || "{}");
  } catch {
    return {};
  }
}

function setStoredMockEntries(entriesByContest) {
  try {
    localStorage.setItem(MOCK_ENTRIES_KEY, JSON.stringify(entriesByContest));
  } catch {
    // Mock mode should not break when storage is blocked.
  }
}

function createSeedEntries(contestId) {
  return [
    {
      id: `${contestId}-seed-1`,
      contest_id: String(contestId),
      user_id: "usr_seed_hana",
      display_name: "hana.creator",
      platform: "instagram",
      sns_url: "https://instagram.com/reel/demo-hana",
      title: "브랜드 숏폼 리뷰",
      like_count: 1842,
      view_count: 42100,
      submitted_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: `${contestId}-seed-2`,
      contest_id: String(contestId),
      user_id: "usr_seed_min",
      display_name: "min.video",
      platform: "youtube",
      sns_url: "https://youtube.com/shorts/demo-min",
      title: "30초 체험 영상",
      like_count: 1260,
      view_count: 38600,
      submitted_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: `${contestId}-seed-3`,
      contest_id: String(contestId),
      user_id: "usr_seed_su",
      display_name: "su.marketing",
      platform: "tiktok",
      sns_url: "https://tiktok.com/@demo/video/123",
      title: "챌린지 참여 영상",
      like_count: 980,
      view_count: 29100,
      submitted_at: new Date(Date.now() - 259200000).toISOString(),
    },
  ];
}

function rankEntries(entries) {
  const nowBoost = Math.floor(Date.now() / 5000);
  return entries
    .map((entry, index) => {
      const liveLikes = Number(entry.like_count || 0) + ((nowBoost + index) % 9);
      const liveViews = Number(entry.view_count || 0) + ((nowBoost + index * 7) % 180);
      return {
        ...entry,
        like_count: liveLikes,
        view_count: liveViews,
        rank_score: liveLikes * 3 + liveViews,
      };
    })
    .sort((a, b) => b.rank_score - a.rank_score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function getMockLeaderboard(contestId) {
  const entriesByContest = getStoredMockEntries();
  const key = String(contestId);
  const entries = entriesByContest[key] || createSeedEntries(key);
  entriesByContest[key] = entries;
  setStoredMockEntries(entriesByContest);
  return {
    contestId: key,
    participantCount: entries.length,
    entries: rankEntries(entries),
    source: "mock",
  };
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${appConfig.apiBaseUrl || ""}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || "Request failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function fetchBoardJson(path, options = {}) {
  return fetchJson(path, options);
}

function authHeaders(authSession) {
  const token = authSession?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function makeClientIdempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getContestLeaderboard(contestId) {
  if (!appConfig.apiBaseUrl) {
    return getMockLeaderboard(contestId);
  }

  return fetchJson(`/api/contests/${encodeURIComponent(contestId)}/leaderboard`);
}

export function watchContestLeaderboard(contestId, onUpdate) {
  if (!appConfig.apiBaseUrl || typeof EventSource === "undefined") {
    let active = true;
    const tick = async () => {
      const data = getMockLeaderboard(contestId);
      if (active) onUpdate(data);
    };
    tick();
    const interval = window.setInterval(tick, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }

  const source = new EventSource(
    `${appConfig.apiBaseUrl}/api/contests/${encodeURIComponent(contestId)}/leaderboard/stream`
  );
  source.addEventListener("leaderboard", (event) => {
    onUpdate(JSON.parse(event.data));
  });
  source.onerror = () => {
    source.close();
  };
  return () => source.close();
}

export async function joinContest(contestId, authSession) {
  if (!appConfig.apiBaseUrl) {
    return { ok: true, mode: "mock" };
  }

  return fetchJson(`/api/contests/${encodeURIComponent(contestId)}/participations`, {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ profile: authSession?.user || null }),
  });
}

export async function submitContestEntry(contestId, payload, authSession) {
  if (!appConfig.apiBaseUrl) {
    const entriesByContest = getStoredMockEntries();
    const key = String(contestId);
    const entries = entriesByContest[key] || createSeedEntries(key);
    const userId = authSession?.user?.id || "demo-user";
    const entry = {
      id: `${key}-${userId}`,
      contest_id: key,
      user_id: userId,
      display_name: authSession?.user?.display_name || authSession?.user?.email || "demo.creator",
      platform: payload.platform,
      sns_url: payload.snsUrl,
      title: payload.title || "제출 영상",
      like_count: 0,
      view_count: 0,
      submitted_at: new Date().toISOString(),
    };
    entriesByContest[key] = [entry, ...entries.filter((item) => item.user_id !== userId)];
    setStoredMockEntries(entriesByContest);
    return { ok: true, entry, mode: "mock" };
  }

  return fetchJson(`/api/contests/${encodeURIComponent(contestId)}/entries`, {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ ...payload, profile: authSession?.user || null }),
  });
}

export async function createPaymentCheckout(productId, authSession) {
  return fetchJson("/api/payments/checkout", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ productId }),
  });
}

export async function createPointChargeCheckout() {
  throw new Error("Point charging is currently disabled.");
}

export async function verifyOrganizerBusiness(payload, authSession) {
  const businessNumber = String(payload?.businessNumber || "").replace(/\D/g, "");
  const startDate = String(payload?.startDate || "").replace(/\D/g, "");
  const representativeName = String(payload?.representativeName || "").trim();

  if (USE_LOCAL_MOCKS) {
    const ok = businessNumber.length === 10 && startDate.length === 8 && representativeName.length > 1;
    return {
      ok,
      mode: "mock",
      verification: {
        type: "business",
        label: ok ? `사업자 ${businessNumber.slice(0, 3)}-${businessNumber.slice(3, 5)}-${businessNumber.slice(5)}` : "",
      },
      message: ok
        ? "사업자 확인이 완료되었습니다."
        : "사업자등록번호, 개업일자, 대표자명을 확인해주세요.",
    };
  }

  return fetchJson("/api/organizer/verification/business", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({
      ...payload,
      businessNumber,
      startDate,
      representativeName,
    }),
  });
}

export async function startOrganizerPassVerification(authSession) {
  if (USE_LOCAL_MOCKS) {
    return {
      ok: true,
      mode: "mock",
      verification: {
        type: "pass",
        label: "PASS 본인인증 완료",
      },
      message: "PASS 본인인증이 완료되었습니다.",
    };
  }

  return fetchJson("/api/organizer/verification/pass/start", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ returnUrl: window.location.href }),
  });
}

export async function verifyOrganizerPaymentCode(code, authSession) {
  const normalizedCode = normalizePaymentCode(code);

  if (USE_LOCAL_MOCKS) {
    const paymentCode = findOrganizerPaymentCode(normalizedCode);
    if (!paymentCode) {
      throw new Error("유효하지 않은 결제 코드입니다.");
    }
    return {
      ok: true,
      mode: "mock",
      paymentCode,
    };
  }

  return fetchJson("/api/organizer/payment-codes/verify", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ code: normalizedCode }),
  });
}

export async function createOrganizerPaymentCheckout(code, authSession) {
  const normalizedCode = normalizePaymentCode(code);

  if (USE_LOCAL_MOCKS) {
    const paymentCode = findOrganizerPaymentCode(normalizedCode);
    if (!paymentCode) {
      throw new Error("유효하지 않은 결제 코드입니다.");
    }
    return {
      ok: true,
      mode: "mock",
      paymentCode: {
        ...paymentCode,
        ...calculateOrganizerPayment(paymentCode.totalAmount),
      },
    };
  }

  return fetchJson("/api/organizer/payment-codes/checkout", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ code: normalizedCode }),
  });
}

export async function getBoardPosts(board = "") {
  const query = board ? `?board=${encodeURIComponent(board)}` : "";
  return fetchBoardJson(`/api/board/posts${query}`);
}

export async function createBoardPost(payload, authSession) {
  return fetchBoardJson("/api/board/posts", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify(payload),
  });
}

export async function updateBoardPost(postId, payload, authSession) {
  return fetchBoardJson(`/api/board/posts/${encodeURIComponent(postId)}`, {
    method: "PUT",
    headers: authHeaders(authSession),
    body: JSON.stringify(payload),
  });
}

export async function uploadBoardMediaFile(file, authSession) {
  const sign = await fetchBoardJson("/api/board/media/sign-upload", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({
      name: file.name,
      mime: file.type,
      size: file.size,
    }),
  });

  const formData = new FormData();
  formData.append("cacheControl", "31536000");
  formData.append("", file);

  const uploadResponse = await fetch(sign.signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: formData,
  });

  if (!uploadResponse.ok) {
    let message = "Media upload failed.";
    try {
      const data = await uploadResponse.json();
      message = data?.error || data?.message || message;
    } catch {
      // Keep the default message.
    }
    throw new Error(message);
  }

  return {
    id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: "upload",
    mediaType: sign.mediaType,
    mime: sign.mime,
    name: file.name,
    size: file.size,
    path: sign.path,
    bucket: sign.bucket,
    url: sign.publicUrl,
  };
}

export async function getPointWallet(authSession) {
  return fetchJson("/api/points/wallet", {
    headers: authHeaders(authSession),
  });
}

export async function chargeServerPoints() {
  throw new Error("Point charging is currently disabled.");
}

export async function recordPointTransaction(payload, authSession) {
  const amount = Math.trunc(Number(payload?.amount || 0));
  const type = String(payload?.type || "adjustment");
  const idempotencyKey = payload?.idempotencyKey || makeClientIdempotencyKey(`point-${type}-${Math.abs(amount)}`);
  return fetchJson("/api/points/transaction", {
    method: "POST",
    headers: {
      ...authHeaders(authSession),
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount,
      type,
      description: payload?.description,
      refType: payload?.refType,
      refId: payload?.refId,
      metadata: payload?.metadata || {},
    }),
  });
}

export async function getLecturePosts(authSession) {
  return fetchJson("/api/lecture/posts", {
    headers: authHeaders(authSession),
  });
}

export async function getLecturePost(postId, authSession) {
  return fetchJson(`/api/lecture/posts/${encodeURIComponent(postId)}`, {
    headers: authHeaders(authSession),
  });
}

export async function readLecturePost(postId, authSession, idempotencyKey = "") {
  return fetchJson(`/api/lecture/posts/${encodeURIComponent(postId)}/read`, {
    method: "POST",
    headers: {
      ...authHeaders(authSession),
      "Idempotency-Key": idempotencyKey || makeClientIdempotencyKey(`lecture-read-${postId}`),
    },
    body: JSON.stringify({}),
  });
}

export async function subscribeLecturePost(postId, authSession, idempotencyKey = "") {
  return fetchJson(`/api/lecture/posts/${encodeURIComponent(postId)}/subscribe`, {
    method: "POST",
    headers: {
      ...authHeaders(authSession),
      "Idempotency-Key": idempotencyKey || makeClientIdempotencyKey(`lecture-subscribe-${postId}`),
    },
    body: JSON.stringify({}),
  });
}

export async function getLectureMemberships(authSession) {
  return fetchJson("/api/lecture/memberships", {
    headers: authHeaders(authSession),
  });
}

export async function purchaseLectureMembership(planKey, authSession, idempotencyKey = "") {
  return fetchJson("/api/lecture/memberships", {
    method: "POST",
    headers: {
      ...authHeaders(authSession),
      "Idempotency-Key": idempotencyKey || makeClientIdempotencyKey(`lecture-membership-${planKey}`),
    },
    body: JSON.stringify({ planKey }),
  });
}

export async function getLectureAuthorEarnings(authSession) {
  return fetchJson("/api/lecture/author/earnings", {
    headers: authHeaders(authSession),
  });
}

export async function getLectureAuthorSettlements(authSession) {
  return fetchJson("/api/lecture/author/settlements", {
    headers: authHeaders(authSession),
  });
}

export async function requestLectureAuthorSettlement(note, authSession) {
  return fetchJson("/api/lecture/author/settlements", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify({ note }),
  });
}

export async function createLectureReport(payload, authSession) {
  return fetchJson("/api/lecture/reports", {
    method: "POST",
    headers: authHeaders(authSession),
    body: JSON.stringify(payload),
  });
}

function adminHeaders(adminSecret) {
  return adminSecret ? { "X-Lecture-Admin-Secret": adminSecret } : {};
}

export async function getLectureAdminSummary(adminSecret) {
  return fetchJson("/api/lecture/admin/summary", {
    headers: adminHeaders(adminSecret),
  });
}

export async function createLectureAdminPost(payload, adminSecret) {
  return fetchJson("/api/lecture/admin/posts", {
    method: "POST",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function updateLectureAdminPost(postId, payload, adminSecret) {
  return fetchJson(`/api/lecture/admin/posts/${encodeURIComponent(postId)}`, {
    method: "PUT",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function deleteLectureAdminPost(postId, adminSecret) {
  return fetchJson(`/api/lecture/admin/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    headers: adminHeaders(adminSecret),
  });
}

export async function refundLectureTransaction(payload, adminSecret) {
  return fetchJson("/api/lecture/admin/refund", {
    method: "POST",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function updateLectureAccess(payload, adminSecret) {
  return fetchJson("/api/lecture/admin/access", {
    method: "POST",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function updateLectureReport(reportId, payload, adminSecret) {
  return fetchJson(`/api/lecture/admin/reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function settleLectureAuthorRequest(requestId, payload, adminSecret) {
  return fetchJson(`/api/lecture/admin/settlements/${encodeURIComponent(requestId)}`, {
    method: "POST",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

export async function updateLectureAuthorPermission(payload, adminSecret) {
  return fetchJson("/api/lecture/admin/authors", {
    method: "POST",
    headers: adminHeaders(adminSecret),
    body: JSON.stringify(payload),
  });
}

import { appConfig } from "../config/appConfig";

const MOCK_ENTRIES_KEY = "adsduck-mock-contest-entries";

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
  if (!appConfig.apiBaseUrl) {
    throw new Error("API base URL is not configured.");
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed.");
  }

  return data;
}

function authHeaders(authSession) {
  const token = authSession?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
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

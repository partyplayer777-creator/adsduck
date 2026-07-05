const DEFAULT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function getMetricRefreshIntervalMs() {
  const value = Number(process.env.CONTEST_METRIC_REFRESH_INTERVAL_MS || 0);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REFRESH_INTERVAL_MS;
}

function getYouTubeApiKey() {
  return String(
    process.env.YOUTUBE_DATA_API_KEY ||
    process.env.GOOGLE_YOUTUBE_API_KEY ||
    process.env.YOUTUBE_API_KEY ||
    ""
  ).trim();
}

function detectProvider(platform, snsUrl) {
  const value = `${platform || ""} ${snsUrl || ""}`.toLowerCase();
  if (value.includes("youtube") || value.includes("youtu.be")) return "youtube";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("tiktok")) return "tiktok";
  return "unknown";
}

function extractYouTubeVideoId(snsUrl) {
  let url;
  try {
    url = new URL(snsUrl);
  } catch {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
  if (!host.endsWith("youtube.com")) return "";

  if (url.pathname === "/watch") return url.searchParams.get("v") || "";
  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || "";
  return "";
}

function toCount(value) {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

async function fetchYouTubeMetrics(snsUrl) {
  const videoId = extractYouTubeVideoId(snsUrl);
  if (!videoId) return { ok: false, provider: "youtube", reason: "invalid_video_url" };

  const apiKey = getYouTubeApiKey();
  if (!apiKey) return { ok: false, provider: "youtube", reason: "missing_api_key" };

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { ok: false, provider: "youtube", reason: `youtube_${response.status}` };
  }

  const data = await response.json();
  const item = data?.items?.[0];
  if (!item?.statistics) return { ok: false, provider: "youtube", reason: "not_found" };

  return {
    ok: true,
    provider: "youtube",
    viewCount: toCount(item.statistics.viewCount),
    likeCount: toCount(item.statistics.likeCount),
  };
}

export async function fetchExternalVideoMetrics({ platform, snsUrl }) {
  const provider = detectProvider(platform, snsUrl);
  if (provider === "youtube") return fetchYouTubeMetrics(snsUrl);

  return {
    ok: false,
    provider,
    reason: provider === "unknown" ? "unsupported_url" : "provider_requires_oauth",
  };
}

export function isMetricStale(entry) {
  if (!entry?.last_synced_at) return true;
  const syncedAt = new Date(entry.last_synced_at).getTime();
  if (!Number.isFinite(syncedAt)) return true;
  return Date.now() - syncedAt > getMetricRefreshIntervalMs();
}

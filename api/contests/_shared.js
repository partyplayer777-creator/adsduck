import { requireAuth } from "../_auth.js";
import { getSupabase } from "../_supabase.js";
import { refreshEntryMetrics, refreshStaleEntryMetrics } from "./_metrics.js";

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function getContestId(req) {
  const contestId = String(req.query?.contestId || "").trim();
  if (!contestId) throw badRequest("contestId is required.");
  return contestId;
}

export async function getAuthPayload(req) {
  return requireAuth(req);
}

export function normalizeMetricCount(value, fieldName) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw badRequest(`${fieldName} must be a non-negative number.`);
  }
  return number;
}

export async function upsertProfileFromAuth(supabase, authPayload, profilePayload = null) {
  if (!authPayload?.sub) return null;

  const profile = {
    id: authPayload.sub,
    display_name: profilePayload?.display_name || authPayload.display_name || authPayload.name || null,
    email: profilePayload?.email || authPayload.email || null,
    avatar_url: profilePayload?.profile_image || profilePayload?.avatar_url || authPayload.picture || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function joinContest({ contestId, authPayload, profilePayload = null }) {
  const supabase = getSupabase();
  await upsertProfileFromAuth(supabase, authPayload, profilePayload);

  const row = {
    contest_id: String(contestId),
    user_id: authPayload.sub,
    status: "joined",
    joined_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contest_participations")
    .upsert(row, { onConflict: "contest_id,user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitEntry({ contestId, authPayload, payload }) {
  const supabase = getSupabase();
  await joinContest({ contestId, authPayload, profilePayload: payload.profile });

  const { data: existing, error: existingError } = await supabase
    .from("contest_entries")
    .select("id, sns_url, submitted_at")
    .eq("contest_id", String(contestId))
    .eq("user_id", authPayload.sub)
    .maybeSingle();

  if (existingError) throw existingError;

  const row = {
    contest_id: String(contestId),
    user_id: authPayload.sub,
    platform: payload.platform,
    sns_url: payload.snsUrl,
    title: payload.title || null,
    status: "submitted",
    submitted_at: existing?.submitted_at || new Date().toISOString(),
  };

  if (existing?.sns_url && existing.sns_url !== payload.snsUrl) {
    row.like_count = 0;
    row.view_count = 0;
    row.last_synced_at = null;
  }

  const { data, error } = await supabase
    .from("contest_entries")
    .upsert(row, { onConflict: "contest_id,user_id" })
    .select()
    .single();

  if (error) throw error;
  const syncResult = await refreshEntryMetrics(supabase, data, { force: true }).catch(() => null);
  return { ...(syncResult?.entry || data), created: !existing };
}

export async function getLeaderboard(contestId) {
  const supabase = getSupabase();
  const loadEntries = () => supabase
    .from("contest_entry_leaderboard")
    .select("*")
    .eq("contest_id", String(contestId))
    .order("rank_score", { ascending: false })
    .order("submitted_at", { ascending: true })
    .limit(100);

  let { data: entries, error } = await loadEntries();

  if (error) throw error;
  const updatedCount = await refreshStaleEntryMetrics(supabase, entries || []);
  if (updatedCount > 0) {
    const refreshed = await loadEntries();
    if (refreshed.error) throw refreshed.error;
    entries = refreshed.data || [];
  }

  const { count, error: countError } = await supabase
    .from("contest_participations")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", String(contestId));

  if (countError) throw countError;

  return {
    contestId: String(contestId),
    participantCount: count || entries.length,
    entries: entries.map((entry, index) => ({ ...entry, rank: index + 1 })),
    source: "supabase",
  };
}

export async function updateEntryMetrics({ entryId, snsUrl, likeCount, viewCount }) {
  if (!entryId && !snsUrl) throw badRequest("entryId or snsUrl is required.");

  const supabase = getSupabase();
  const patch = {
    like_count: normalizeMetricCount(likeCount, "likeCount"),
    view_count: normalizeMetricCount(viewCount, "viewCount"),
    last_synced_at: new Date().toISOString(),
  };

  let query = supabase.from("contest_entries").update(patch).select().single();
  query = entryId ? query.eq("id", entryId) : query.eq("sns_url", snsUrl);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

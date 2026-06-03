import { supabase } from "../lib/supabase.mjs";

export async function upsertProfileFromAuth(authPayload, profilePayload = null) {
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
  await upsertProfileFromAuth(authPayload, profilePayload);

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
  await joinContest({ contestId, authPayload, profilePayload: payload.profile });

  const row = {
    contest_id: String(contestId),
    user_id: authPayload.sub,
    platform: payload.platform,
    sns_url: payload.snsUrl,
    title: payload.title || null,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contest_entries")
    .upsert(row, { onConflict: "contest_id,user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLeaderboard(contestId) {
  const { data: entries, error } = await supabase
    .from("contest_entry_leaderboard")
    .select("*")
    .eq("contest_id", String(contestId))
    .order("rank_score", { ascending: false })
    .order("submitted_at", { ascending: true })
    .limit(100);

  if (error) throw error;

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
  const patch = {
    like_count: Number(likeCount || 0),
    view_count: Number(viewCount || 0),
    last_synced_at: new Date().toISOString(),
  };

  let query = supabase.from("contest_entries").update(patch).select().single();
  query = entryId ? query.eq("id", entryId) : query.eq("sns_url", snsUrl);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

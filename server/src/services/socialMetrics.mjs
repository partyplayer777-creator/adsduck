import { updateEntryMetrics } from "./leaderboard.mjs";

export async function applyMetricUpdates(updates) {
  if (!Array.isArray(updates)) {
    throw new Error("updates must be an array.");
  }

  const results = [];
  for (const update of updates) {
    if (!update.entryId && !update.snsUrl) {
      throw new Error("entryId or snsUrl is required.");
    }
    results.push(await updateEntryMetrics(update));
  }

  return results;
}


import { createClient } from "@supabase/supabase-js";
import { config } from "../config.mjs";

let client = null;

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    const error = new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    error.status = 503;
    throw error;
  }

  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const activeClient = getSupabase();
    const value = activeClient[prop];
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});

export async function assertSupabaseReady() {
  const { error } = await supabase.from("contest_entries").select("id", { count: "exact", head: true });
  if (error) throw error;
}

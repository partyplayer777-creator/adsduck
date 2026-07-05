import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config/appConfig";

export const supabase = appConfig.supabaseUrl && appConfig.supabaseAnonKey
  ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
        storageKey: "adsduck-supabase-auth",
      },
    })
  : null;

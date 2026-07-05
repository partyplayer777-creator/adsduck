function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export const appConfig = {
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_ADSDUCK_API_BASE_URL || ""),
  authBaseUrl: trimTrailingSlash(import.meta.env.VITE_ADSDUCK_AUTH_BASE_URL || ""),
  authClientId: import.meta.env.VITE_ADSDUCK_AUTH_CLIENT_ID || "adsduck",
  supabaseUrl: trimTrailingSlash(
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_ADSDUCK_SUPABASE_URL || ""
  ),
  supabaseAnonKey: String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_ADSDUCK_SUPABASE_ANON_KEY || ""
  ).trim(),
};

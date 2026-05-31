export const appConfig = {
  apiBaseUrl: (import.meta.env.VITE_ADSDUCK_API_BASE_URL || "").replace(/\/$/, ""),
  authBaseUrl: (import.meta.env.VITE_ADSDUCK_AUTH_BASE_URL || "").replace(/\/$/, ""),
  authClientId: import.meta.env.VITE_ADSDUCK_AUTH_CLIENT_ID || "adsduck",
};


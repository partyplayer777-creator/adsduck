import { useCallback, useEffect, useState } from "react";
import { appConfig } from "../config/appConfig";

const AUTH_STORAGE_KEY = "adsduck-auth-session";

function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Auth state can still live in memory if storage is blocked.
  }
}

function makeReturnTo() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

function buildAuthorizeUrl(provider, mode, options = {}) {
  const safeProvider = ["google", "kakao", "naver"].includes(provider) ? provider : "authorize";
  const url = new URL(`/auth/${safeProvider}`, `${appConfig.authBaseUrl}/`);
  url.searchParams.set("client", appConfig.authClientId);
  url.searchParams.set("returnTo", makeReturnTo());
  url.searchParams.set("responseMode", "web_message");
  url.searchParams.set("state", `${mode}:${provider}:${Date.now()}`);
  if (mode === "signup") {
    url.searchParams.set("marketingConsent", options.marketingConsent ? "1" : "0");
  }
  return url.toString();
}

async function exchangeAuthCode(code) {
  const response = await fetch(new URL("/auth/token/exchange", `${appConfig.authBaseUrl}/`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      clientId: appConfig.authClientId,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "로그인 토큰 교환에 실패했습니다.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
    user: data.user,
    isNewUser: data.is_new_user,
  };
}

export function useAuthSession() {
  const [session, setSession] = useState(readStoredSession);
  const [authError, setAuthError] = useState("");

  const persistSession = useCallback((nextSession) => {
    setSession(nextSession);
    writeStoredSession(nextSession);
  }, []);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (!appConfig.authBaseUrl || event.origin !== new URL(appConfig.authBaseUrl).origin) {
        return;
      }

      const payload = event.data || {};
      if (payload.type === "partydeck-auth:error") {
        setAuthError(payload.error || "로그인에 실패했습니다.");
        return;
      }

      if (payload.type !== "partydeck-auth:code" || !payload.code) {
        return;
      }

      try {
        const nextSession = await exchangeAuthCode(payload.code);
        persistSession(nextSession);
        setAuthError("");
      } catch (error) {
        setAuthError(error.message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [persistSession]);

  const loginWithProvider = useCallback((provider = "google", mode = "login", options = {}) => {
    setAuthError("");

    if (!appConfig.authBaseUrl) {
      const displayName = mode === "signup" ? "new.creator" : "demo.creator";
      persistSession({
        accessToken: `demo-${Date.now()}`,
        refreshToken: null,
        expiresAt: Date.now() + 3600_000,
        user: {
          id: "demo-user",
          display_name: displayName,
          email: `${displayName}@adsduck.local`,
          profile_image: null,
          marketing_consent: !!options.marketingConsent,
        },
        isNewUser: mode === "signup",
        marketingConsent: !!options.marketingConsent,
        mode: "mock",
      });
      return;
    }

    window.open(
      buildAuthorizeUrl(provider, mode, options),
      "adsduck-auth",
      "popup,width=460,height=720"
    );
  }, [persistSession]);

  const logout = useCallback(() => {
    persistSession(null);
    setAuthError("");
  }, [persistSession]);

  return {
    session,
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    authError,
    loginWithProvider,
    logout,
  };
}

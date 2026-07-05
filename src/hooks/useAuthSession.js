import { useCallback, useEffect, useState } from "react";
import { appConfig } from "../config/appConfig";
import { supabase } from "../lib/supabaseClient";

const AUTH_STORAGE_KEY = "adsduck-auth-session";
const PENDING_SIGNUP_KEY = "adsduck-auth-pending-signup";
const SOCIAL_PROVIDERS = [
  { id: "google", oauthProvider: "google", settingKeys: ["google"] },
  { id: "kakao", oauthProvider: "kakao", settingKeys: ["kakao"] },
  { id: "naver", oauthProvider: "custom:naver", settingKeys: ["custom:naver", "naver"] },
];
const SOCIAL_PROVIDER_IDS = SOCIAL_PROVIDERS.map((provider) => provider.id);

function normalizeProviderId(provider) {
  if (provider === "custom:naver") return "naver";
  return SOCIAL_PROVIDER_IDS.includes(provider) ? provider : "google";
}

function resolveOAuthProvider(provider) {
  const providerId = normalizeProviderId(provider);
  return SOCIAL_PROVIDERS.find((item) => item.id === providerId)?.oauthProvider || "google";
}

function resolveEnabledProviders(settings) {
  const external = settings?.external || {};
  return SOCIAL_PROVIDERS
    .filter((provider) => provider.settingKeys.some((key) => !!external[key]))
    .map((provider) => provider.id);
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Auth state can still live in memory if storage is blocked.
  }
}

function isMockSession(session) {
  return (
    session?.mode === "mock" ||
    session?.user?.id === "demo-user" ||
    String(session?.accessToken || "").startsWith("demo-")
  );
}

function readStoredSession() {
  const session = readJson(AUTH_STORAGE_KEY);
  if (isMockSession(session)) {
    writeJson(AUTH_STORAGE_KEY, null);
    return null;
  }
  return session;
}

function makeReturnTo() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

function pickFirst(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function normalizeSupabaseUser(user) {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const identityData = user.identities?.[0]?.identity_data || {};
  const email = user.email || identityData.email || null;
  const displayName =
    pickFirst(
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      identityData.full_name,
      identityData.name,
      email?.split("@")[0]
    ) || "사용자";
  const avatarUrl = pickFirst(
    metadata.avatar_url,
    metadata.picture,
    identityData.avatar_url,
    identityData.picture
  );

  return {
    id: user.id,
    display_name: displayName,
    email,
    profile_image: avatarUrl,
    avatar_url: avatarUrl,
    provider: appMetadata.provider || identityData.provider || null,
    providers: appMetadata.providers || [],
    marketing_consent: !!metadata.marketing_consent,
  };
}

function normalizeSupabaseSession(nextSession) {
  if (!nextSession?.access_token || !nextSession?.user) return null;

  return {
    accessToken: nextSession.access_token,
    refreshToken: nextSession.refresh_token || null,
    expiresAt: nextSession.expires_at ? nextSession.expires_at * 1000 : null,
    user: normalizeSupabaseUser(nextSession.user),
    isNewUser: false,
    mode: "supabase",
  };
}

function buildAuthorizeUrl(provider, mode, options = {}) {
  const safeProvider = SOCIAL_PROVIDER_IDS.includes(provider) ? provider : "authorize";
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
    mode: "legacy",
  };
}

async function applyPendingSignupMetadata(nextSession) {
  if (!supabase || !nextSession?.user) return null;

  const pending = readJson(PENDING_SIGNUP_KEY);
  if (!pending) return null;
  if (!pending.startedAt || Date.now() - Number(pending.startedAt) > 30 * 60 * 1000) {
    writeJson(PENDING_SIGNUP_KEY, null);
    return null;
  }

  const currentMetadata = nextSession.user.user_metadata || {};
  const nextMetadata = {
    ...currentMetadata,
    marketing_consent: !!pending.marketingConsent,
  };

  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });
  if (error) throw error;

  writeJson(PENDING_SIGNUP_KEY, null);
  return data?.user || null;
}

export function useAuthSession() {
  const [session, setSession] = useState(() => (supabase ? null : readStoredSession()));
  const [authError, setAuthError] = useState("");
  const [enabledProviders, setEnabledProviders] = useState(() => (
    supabase ? [] : SOCIAL_PROVIDER_IDS
  ));

  const persistSession = useCallback((nextSession) => {
    setSession(nextSession);

    if (!supabase || nextSession?.mode === "legacy") {
      writeJson(AUTH_STORAGE_KEY, nextSession);
      return;
    }

    writeJson(AUTH_STORAGE_KEY, null);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let ignore = false;

    const syncSession = (nextSupabaseSession) => {
      if (ignore) return;

      const normalized = normalizeSupabaseSession(nextSupabaseSession);
      persistSession(normalized);

      if (!nextSupabaseSession?.user) return;

      applyPendingSignupMetadata(nextSupabaseSession)
        .then((updatedUser) => {
          if (ignore || !updatedUser) return;
          persistSession(normalizeSupabaseSession({ ...nextSupabaseSession, user: updatedUser }));
        })
        .catch((error) => {
          if (!ignore) setAuthError(error.message || "회원 정보를 저장하지 못했습니다.");
        });
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (ignore) return;
      if (error) {
        setAuthError(error.message);
        return;
      }
      syncSession(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSupabaseSession) => {
      syncSession(nextSupabaseSession);
      if (nextSupabaseSession?.user) setAuthError("");
    });

    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe();
    };
  }, [persistSession]);

  useEffect(() => {
    if (!supabase || !appConfig.supabaseUrl || !appConfig.supabaseAnonKey) return undefined;

    let ignore = false;
    fetch(`${appConfig.supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: appConfig.supabaseAnonKey,
        Authorization: `Bearer ${appConfig.supabaseAnonKey}`,
      },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        if (ignore || !settings?.external) return;
        setEnabledProviders(resolveEnabledProviders(settings));
      })
      .catch(() => {
        if (!ignore) setEnabledProviders([]);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!appConfig.authBaseUrl) return undefined;

    const handleMessage = async (event) => {
      if (event.origin !== new URL(appConfig.authBaseUrl).origin) {
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

  const loginWithProvider = useCallback(async (provider = "google", mode = "login", options = {}) => {
    setAuthError("");

    const safeProvider = normalizeProviderId(provider);

    if (supabase) {
      if (mode === "signup") {
        writeJson(PENDING_SIGNUP_KEY, {
          marketingConsent: !!options.marketingConsent,
          startedAt: Date.now(),
        });
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: resolveOAuthProvider(safeProvider),
        options: {
          redirectTo: makeReturnTo(),
          queryParams: safeProvider === "google" ? { prompt: "select_account" } : undefined,
        },
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }

      return true;
    }

    if (appConfig.authBaseUrl) {
      window.open(
        buildAuthorizeUrl(safeProvider, mode, options),
        "adsduck-auth",
        "popup,width=460,height=720"
      );
      return true;
    }

    setAuthError("실제 로그인을 사용하려면 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
    return false;
  }, []);

  const loginWithEmail = useCallback(async (email, password, mode = "login", options = {}) => {
    setAuthError("");

    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail || !password) {
      setAuthError("이메일과 비밀번호를 입력하세요.");
      return false;
    }

    if (mode === "signup" && !options.marketingConsent) {
      setAuthError("필수 동의 항목을 체크해야 회원가입할 수 있습니다.");
      return false;
    }

    if (!supabase) {
      setAuthError("실제 로그인을 사용하려면 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return false;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: makeReturnTo(),
          data: {
            display_name: normalizedEmail.split("@")[0],
            marketing_consent: !!options.marketingConsent,
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }

      if (!data?.session) {
        setAuthError("가입 확인 이메일을 보냈습니다. 메일 확인 후 로그인하세요.");
        return false;
      }

      setAuthError("");
      return true;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return false;
    }

    setAuthError("");
    return true;
  }, []);

  const logout = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
    }

    persistSession(null);
    setAuthError("");
  }, [persistSession]);

  return {
    session,
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    authError,
    enabledProviders,
    loginWithProvider,
    loginWithEmail,
    logout,
  };
}

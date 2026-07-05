import { useEffect, useRef, useState } from "react";

const PROVIDERS = [
  { provider: "google", label: "Google로 계속", icon: GoogleIcon, tone: "border-gray-200 bg-white text-gray-800" },
  { provider: "kakao", label: "Kakao로 계속", icon: KakaoIcon, tone: "border-[#FEE500] bg-[#FEE500] text-[#191600]" },
  { provider: "naver", label: "Naver로 계속", icon: NaverIcon, tone: "border-[#03C75A] bg-[#03C75A] text-white" },
];

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.77-.07-1.51-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.52Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.45l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.88A6.01 6.01 0 0 1 6.09 12c0-.65.11-1.29.31-1.88V7.53H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.47l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.82 1.5l2.87-2.87C16.95 3.01 14.69 2 12 2a10 10 0 0 0-8.94 5.53l3.34 2.59C7.19 7.76 9.4 6 12 6Z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#191600"
        d="M12 4C6.75 4 2.5 7.32 2.5 11.42c0 2.64 1.75 4.96 4.39 6.27l-.72 2.64a.44.44 0 0 0 .67.49l3.14-2.08c.65.08 1.32.13 2.02.13 5.25 0 9.5-3.33 9.5-7.45S17.25 4 12 4Z"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M15.42 12.62 8.28 2H2.5v20h6.08v-10.62L15.72 22h5.78V2h-6.08v10.62Z" />
    </svg>
  );
}

export default function AuthDialog({
  mode = "login",
  open,
  error,
  onClose,
  onProviderLogin,
  onEmailLogin,
  enabledProviders = [],
}) {
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const autoSignupStartedRef = useRef("");
  const isSignup = mode === "signup";
  const providerIds = enabledProviders.length > 0 ? enabledProviders : (isSignup ? ["google"] : []);
  const visibleProviders = PROVIDERS.filter((item) => providerIds.includes(item.provider));
  const showEmailForm = !isSignup;
  const autoSignupProvider = isSignup && visibleProviders.length === 1 ? visibleProviders[0].provider : null;

  const title = isSignup ? "회원가입" : "로그인";
  const subtitle = isSignup
    ? "소셜 계정으로 가입하고 공모전 참여 기록과 포인트를 저장하세요."
    : "실제 계정으로 로그인해 공모전 참여 기록과 포인트를 불러오세요.";

  const requireSignupConsent = () => {
    if (isSignup && !marketingConsent) {
      setLocalError("필수 동의 항목을 체크해야 회원가입할 수 있습니다.");
      return false;
    }
    return true;
  };

  const handleProviderClick = async (provider) => {
    setPending(true);
    const started = await onProviderLogin?.(provider, mode, { marketingConsent: false });
    setPending(false);
    if (started === false) return;
    setLocalError("");
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    if (!requireSignupConsent()) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setLocalError("이메일과 비밀번호를 입력하세요.");
      return;
    }
    if (password.length < 6) {
      setLocalError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setPending(true);
    const started = await onEmailLogin?.(normalizedEmail, password, mode, { marketingConsent });
    setPending(false);
    if (started === false) return;

    setLocalError("");
    setPassword("");
    onClose?.();
  };

  const handleClose = () => {
    setLocalError("");
    setPassword("");
    onClose?.();
  };

  useEffect(() => {
    if (!open) {
      autoSignupStartedRef.current = "";
      return;
    }
    if (!autoSignupProvider) return;

    const autoSignupKey = `${mode}:${autoSignupProvider}`;
    if (autoSignupStartedRef.current === autoSignupKey) return;
    autoSignupStartedRef.current = autoSignupKey;

    let active = true;
    Promise.resolve(onProviderLogin?.(autoSignupProvider, mode, { marketingConsent: false }))
      .then((started) => {
        if (!active) return;
        if (started === false) {
          autoSignupStartedRef.current = "";
          setLocalError("소셜 로그인을 시작하지 못했습니다.");
          return;
        }
        setLocalError("");
      })
      .catch((error) => {
        if (!active) return;
        autoSignupStartedRef.current = "";
        setLocalError(error?.message || "소셜 로그인을 시작하지 못했습니다.");
      });

    return () => {
      active = false;
    };
  }, [autoSignupProvider, mode, onProviderLogin, open]);

  if (!open) return null;
  if (autoSignupProvider && !localError && !error) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg border-none bg-transparent p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isSignup && visibleProviders.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs font-bold leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
            소셜 로그인 설정을 확인하는 중입니다. 잠시 후 다시 시도하세요.
          </p>
        )}

        {isSignup && showEmailForm && (
          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-900/20">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => {
                setMarketingConsent(event.target.checked);
                if (event.target.checked) setLocalError("");
              }}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-amber-500"
              aria-required="true"
            />
            <span className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              <b className="font-black text-gray-950 dark:text-white">[필수]</b>{" "}
              공모전 업데이트와 광고/이벤트 안내 수신에 동의합니다.
            </span>
          </label>
        )}

        {showEmailForm && (
          <form className="space-y-3" onSubmit={handleEmailSubmit}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일"
              autoComplete="email"
              className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-950 outline-none transition focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-950 outline-none transition focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            <button
              type="submit"
              disabled={pending}
              className="flex h-12 w-full items-center justify-center rounded-lg border-none bg-gray-950 px-4 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
            >
              {pending ? "처리 중" : "이메일로 로그인"}
            </button>
          </form>
        )}

        {visibleProviders.length > 0 && (
          <>
            {showEmailForm && (
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                <span className="text-[11px] font-black uppercase text-gray-400">or</span>
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>
            )}

            <div className={showEmailForm ? "space-y-2" : "space-y-2 pt-1"}>
              {visibleProviders.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.provider}
                    onClick={() => handleProviderClick(item.provider)}
                    disabled={pending}
                    className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg border px-4 text-sm font-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${item.tone} dark:border-gray-700`}
                  >
                    <Icon />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {(localError || error) && (
          <p className="mt-4 text-xs font-bold text-red-600 dark:text-red-400">
            {localError || error}
          </p>
        )}
      </div>
    </div>
  );
}

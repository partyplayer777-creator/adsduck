import { useState } from "react";

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
  enabledProviders = [],
}) {
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const isSignup = mode === "signup";
  const providerIds = enabledProviders.length > 0 ? enabledProviders : (isSignup ? ["google"] : []);
  const visibleProviders = PROVIDERS.filter((item) => providerIds.includes(item.provider));

  const title = isSignup ? "회원가입" : "로그인";
  const subtitle = isSignup
    ? "소셜 계정으로 가입하고 공모전 참여 기록과 포인트를 저장하세요."
    : "실제 계정으로 로그인해 공모전 참여 기록과 포인트를 불러오세요.";

  const handleProviderClick = async (provider) => {
    setPending(true);
    const started = await onProviderLogin?.(provider, mode);
    setPending(false);
    if (started === false) return;
    setLocalError("");
  };

  const handleClose = () => {
    setLocalError("");
    onClose?.();
  };

  if (!open) return null;

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

        {visibleProviders.length > 0 && (
          <div className="space-y-2 pt-1">
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

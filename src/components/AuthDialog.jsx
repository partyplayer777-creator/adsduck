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

export default function AuthDialog({ mode = "login", open, error, onClose, onProviderLogin }) {
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const isSignup = mode === "signup";

  if (!open) return null;

  const title = isSignup ? "회원가입" : "로그인";
  const subtitle = isSignup
    ? "가입하면 첫 혜택 5,000P가 지급되고 참가 기록이 저장됩니다."
    : "포인트와 공모전 참가 기록을 저장하려면 로그인하세요.";

  const handleProviderClick = (provider) => {
    if (isSignup && !marketingConsent) {
      setConsentError("필수 동의 항목을 체크해야 회원가입할 수 있습니다.");
      return;
    }
    setConsentError("");
    onProviderLogin(provider, mode, { marketingConsent });
  };

  const handleClose = () => {
    setMarketingConsent(false);
    setConsentError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <button
        className="absolute inset-0 cursor-default border-none bg-gray-950/60"
        onClick={handleClose}
        aria-label="로그인 창 닫기"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-950 dark:text-white">{title}</h2>
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

        <div className="space-y-2">
          {isSignup && (
            <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-900/20">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => {
                  setMarketingConsent(event.target.checked);
                  if (event.target.checked) setConsentError("");
                }}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-amber-500"
                aria-required="true"
              />
              <span className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                <b className="font-black text-gray-950 dark:text-white">[필수]</b>{" "}
                공모전이 업데이트되는 것을 연락받을 수 있습니다. 광고성 이벤트 연락 수신에 동의합니다.
              </span>
            </label>
          )}

          {PROVIDERS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.provider}
                onClick={() => handleProviderClick(item.provider)}
                className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg border px-4 text-sm font-black transition hover:brightness-95 ${item.tone} dark:border-gray-700`}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
        </div>

        {(consentError || error) && (
          <p className="mt-4 text-xs font-bold text-red-600 dark:text-red-400">
            {consentError || error}
          </p>
        )}
      </div>
    </div>
  );
}

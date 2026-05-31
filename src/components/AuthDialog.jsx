import { useState } from "react";

export default function AuthDialog({ mode = "login", open, error, onClose, onProviderLogin }) {
  const [marketingConsent, setMarketingConsent] = useState(false);

  if (!open) return null;

  const title = mode === "signup" ? "회원가입" : "유저 로그인";
  const subtitle =
    mode === "signup"
      ? "첫 로그인 시 계정이 자동 생성되고 공모전 참가 기록이 연결됩니다."
      : "참가 링크 제출과 랭킹 확인을 위해 로그인합니다.";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <button
        className="absolute inset-0 bg-gray-950/60 border-none cursor-default"
        onClick={onClose}
        aria-label="로그인 창 닫기"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-extrabold text-gray-950 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {mode === "signup" && (
            <label className="mb-3 flex items-start gap-3 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-900/20 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                광고성 이벤트 연락 수신에 동의합니다. 공모전이 업데이트 되는 것을 연락 받을 수 있습니다.
              </span>
            </label>
          )}
          {[
            { provider: "google", label: "Google로 계속" },
            { provider: "kakao", label: "Kakao로 계속" },
            { provider: "naver", label: "Naver로 계속" },
          ].map((item) => (
            <button
              key={item.provider}
              onClick={() => onProviderLogin(item.provider, mode, { marketingConsent })}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm font-bold text-gray-800 dark:text-gray-100 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          개발 환경에서 인증 서버 주소가 없으면 데모 계정으로 로그인됩니다.
        </p>
      </div>
    </div>
  );
}

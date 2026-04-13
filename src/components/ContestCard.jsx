import React from "react";

// 검색어 하이라이트 헬퍼
// split()에 캡처 그룹 정규식 사용 시 홀수 인덱스(1,3,5...)가 매칭된 텍스트
function Highlight({ text, query }) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-200 rounded px-0.5 not-italic font-bold"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// 카테고리별 accent bar 그라디언트
const categoryBarGradient = {
  "SNS 마케팅":  "from-blue-500 to-sky-400",
  "리뷰 콘텐츠": "from-cyan-500 to-teal-400",
  "인스타그램":  "from-pink-500 to-rose-400",
  "유튜브":     "from-red-600 to-red-500",
  "틱톡":      "from-violet-600 to-purple-500",
  "멀티 채널":  "from-amber-500 to-yellow-400",
};

// D-day에 따른 단계별 색상 + 무게
function getDdayStyle(daysLeft, isExpired) {
  if (isExpired) return "text-gray-400 dark:text-gray-600 font-bold";
  if (daysLeft <= 1) return "text-red-600 dark:text-red-400 font-black animate-pulse-soft";
  if (daysLeft <= 3) return "text-red-500 dark:text-red-400 font-extrabold";
  if (daysLeft <= 7) return "text-orange-500 dark:text-orange-400 font-bold";
  return "text-amber-600 dark:text-amber-400 font-bold";
}

function getDdayBarColor(daysLeft, isExpired) {
  if (isExpired) return "bg-gray-300 dark:bg-gray-700";
  if (daysLeft <= 1) return "bg-gradient-to-r from-red-600 to-red-500";
  if (daysLeft <= 3) return "bg-gradient-to-r from-red-500 to-red-400";
  if (daysLeft <= 7) return "bg-gradient-to-r from-orange-400 to-red-400";
  return "bg-gradient-to-r from-amber-400 to-amber-500";
}

export default function ContestCard({ contest, onClick, index = 0, isBookmarked, onToggleBookmark, onToast, searchQuery = "", onCategoryClick }) {
  const [logoError, setLogoError] = React.useState(false);
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

  const daysLeft = Math.ceil(
    (new Date(contest.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  );

  const isExpired = daysLeft <= 0;
  const isUrgent = !isExpired && (contest.status === "마감임박" || daysLeft <= 7);

  // 60일 기준으로 긴급도 계산 (마감이 가까울수록 바가 채워짐)
  const REFERENCE_DAYS = 60;
  const progress = isExpired
    ? 100
    : Math.max(3, Math.min(97, 100 - (daysLeft / REFERENCE_DAYS) * 100));

  const categoryColors = {
    "SNS 마케팅": "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    "리뷰 콘텐츠": "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
    "인스타그램": "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
    "유튜브": "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    "틱톡": "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    "멀티 채널": "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark(contest.id);
    onToast?.(isBookmarked ? "북마크 해제됨" : "북마크에 추가됨 🔖");
  };

  const handleCardKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(contest);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/promo-hub/?c=${contest.id}`;
    const text = `📢 ${contest.title}\n💰 ${contest.prize}\n⏰ 마감: ${contest.deadline}\n\nAdsDuck에서 확인하세요!\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: contest.title, text });
        onToast?.("공유 완료!");
      } else {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
        onToast?.("클립보드에 복사됨");
      }
    } catch {
      // 사용자가 취소한 경우 무시
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(contest)}
      onKeyDown={handleCardKeyDown}
      aria-label={`${contest.title} 공모전 상세 보기`}
      className={`group text-left bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden w-full animate-fade-in-up cursor-pointer card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 transition-colors duration-200 ${
        isExpired
          ? "border-gray-100 dark:border-gray-800 opacity-60"
          : !isExpired && daysLeft <= 1
          ? "border-red-300 dark:border-red-700/60 shadow-lg shadow-red-500/10 group-hover:border-red-400 dark:group-hover:border-red-600"
          : "border-gray-100 dark:border-gray-800 group-hover:border-amber-200 dark:group-hover:border-amber-800/50"
      }`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Top accent bar — 카테고리별 고유 색상, 마감 시 희미하게 유지 */}
      <div className={`h-1 bg-gradient-to-r ${categoryBarGradient[contest.category] || "from-amber-500 to-yellow-400"} transition-opacity duration-300 ${
        isExpired ? "opacity-20" : "opacity-60 group-hover:opacity-100"
      }`} />

      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {logoError ? (
                <div className={`w-11 h-11 rounded-xl shadow-sm flex items-center justify-center text-white font-black text-base select-none ${isExpired ? "bg-gray-400 dark:bg-gray-600" : "bg-amber-500"}`}>
                  {contest.company.charAt(0)}
                </div>
              ) : (
                <div className="relative w-11 h-11">
                  {!logoLoaded && (
                    <div className="absolute inset-0 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  )}
                  <img
                    src={contest.logo}
                    alt={contest.company}
                    loading="lazy"
                    className={`w-11 h-11 rounded-xl shadow-sm transition-opacity duration-200 ${isExpired ? "grayscale" : ""} ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => setLogoError(true)}
                  />
                </div>
              )}
              {isUrgent && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse-soft" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                <Highlight text={contest.company} query={searchQuery} />
              </p>
              <span
                className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                  isExpired
                    ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    : isUrgent
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}
              >
                {isExpired ? "마감됨" : isUrgent ? "마감임박" : "진행중"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onCategoryClick?.(contest.category); }}
              title={`"${contest.category}" 카테고리만 보기`}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-75 bg-transparent border-none cursor-pointer ${categoryColors[contest.category] || "bg-gray-100 text-gray-600"}`}
            >
              {contest.category}
            </button>
          </div>
        </div>

        {/* Title */}
        <h3
          className={`text-[17px] font-bold mb-2 transition-colors leading-snug line-clamp-2 ${
            isExpired
              ? "text-gray-400 dark:text-gray-600"
              : "text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400"
          }`}
          title={contest.title}
        >
          <Highlight text={contest.title} query={searchQuery} />
        </h3>

        {/* Description */}
        <p
          className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-5 leading-relaxed"
          title={contest.description}
        >
          {contest.description}
        </p>

        {/* Deadline progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {isExpired ? "마감" : "마감까지"}
            </span>
            <div className="flex items-center gap-1.5">
              {!isExpired && (
                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium">
                  {(() => {
                    const d = new Date(contest.deadline);
                    const m = d.getMonth() + 1;
                    const day = d.getDate();
                    const w = ["일","월","화","수","목","금","토"][d.getDay()];
                    return `${m}/${day}(${w})`;
                  })()}
                </span>
              )}
              <span className={`text-xs ${getDdayStyle(daysLeft, isExpired)}`}>
                {isExpired
                  ? "마감됨"
                  : daysLeft === 1
                  ? "내일 마감!"
                  : `D-${daysLeft}`}
              </span>
            </div>
          </div>
          <div
            className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={isExpired ? "마감됨" : `D-${daysLeft} 남음`}
          >
            <div
              className={`h-full rounded-full transition-all duration-1000 ${getDdayBarColor(daysLeft, isExpired)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
              {contest.participants.toLocaleString()}명
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prize */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">최대</span>
              <span className={`text-base font-extrabold transition-colors duration-200 ${
                isExpired
                  ? "text-gray-400 dark:text-gray-600"
                  : "text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300"
              }`}>
                {(contest.prizeAmount / 10000).toLocaleString()}만원
              </span>
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className={`p-2.5 rounded-lg transition-all bg-transparent border-none cursor-pointer ${
                isCopied
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              aria-label={isCopied ? "복사됨" : "공유하기"}
            >
              {isCopied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </button>

            {/* Bookmark button */}
            <button
              onClick={handleBookmark}
              className={`p-2.5 rounded-lg transition-all bg-transparent border-none cursor-pointer ${
                isBookmarked
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              aria-label={isBookmarked ? "북마크 해제" : "북마크"}
            >
              <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

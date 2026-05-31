import { useState, useEffect } from "react";
import { getStoredItem, STORAGE_KEYS, LEGACY_STORAGE_KEYS } from "../storageKeys";
import EntrySubmitDialog from "./EntrySubmitDialog";
import ParticipantLeaderboard from "./ParticipantLeaderboard";

function formatCount(n) {
  if (n >= 10000) return `${Math.floor(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return String(n);
}

function getStoredVisited() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.visited, LEGACY_STORAGE_KEYS.visited) || "[]");
  } catch {
    return [];
  }
}

function RelatedLogo({ contest }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
        {contest.company.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={contest.logo}
      alt={contest.company}
      className="w-10 h-10 rounded-xl shadow-sm flex-shrink-0"
      onError={() => setErr(true)}
    />
  );
}

// "1등 300만원 / 2등 150만원 / 3등 50만원" → [{rank, amount}, ...]
function parsePrize(prizeStr) {
  return prizeStr.split(" / ").map((part) => {
    const match = part.match(/(\d+등)\s+(.+)/);
    return match ? { rank: match[1], amount: match[2] } : { rank: "상금", amount: part };
  });
}

export default function ContestDetail({ contest, contests = [], onBack, onSelect, bookmarks, onToggleBookmark, onToast, authSession, pointAccount, onRequireLogin }) {
  const [logoError, setLogoError] = useState(false);
  const [, setTick] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [showStickyTitle, setShowStickyTitle] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);

  // D-day를 1분마다 재계산 (탭을 오래 열어뒀을 때 stale 방지)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ESC 키로 뒤로가기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // 스크롤 120px 이상이면 sticky bar에 타이틀 표시
  useEffect(() => {
    const handleScroll = () => setShowStickyTitle(window.scrollY > 120);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const daysLeft = Math.ceil(
    (new Date(contest.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysLeft <= 0;
  const isUrgent = !isExpired && (contest.status === "마감임박" || daysLeft <= 7);
  const isBookmarked = bookmarks.includes(contest.id);
  const prizeBreakdown = parsePrize(contest.prize);

  // Hero D-day 진행 바
  const REFERENCE_DAYS = 60;
  const heroProgress = isExpired
    ? 100
    : Math.max(3, Math.min(97, 100 - (daysLeft / REFERENCE_DAYS) * 100));
  const heroBarColor = isExpired
    ? "bg-gray-400/40"
    : daysLeft <= 1 ? "bg-gradient-to-r from-red-500 to-red-400"
    : daysLeft <= 3 ? "bg-gradient-to-r from-red-400 to-orange-400"
    : daysLeft <= 7 ? "bg-gradient-to-r from-orange-400 to-amber-400"
    : "bg-gradient-to-r from-amber-400 to-yellow-400";

  const handleShare = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}?c=${contest.id}`;
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
      // 사용자가 취소
    }
  };

  const handleParticipate = () => {
    if (!authSession?.user) {
      onRequireLogin?.("login");
      return;
    }
    setEntryDialogOpen(true);
  };

  const infoCards = [
    {
      label: "상금",
      value: contest.prize,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "from-yellow-400 to-orange-500",
    },
    {
      label: "마감일",
      value: isExpired
        ? `${contest.deadline} (마감됨)`
        : daysLeft === 1
        ? `${contest.deadline} (내일 마감!)`
        : daysLeft === 0
        ? `${contest.deadline} (오늘 마감!)`
        : `${contest.deadline} (D-${daysLeft})`,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      color: isExpired
        ? "from-gray-400 to-gray-500"
        : isUrgent
        ? "from-red-400 to-red-500"
        : "from-amber-400 to-amber-500",
    },
    {
      label: "참여자",
      value: `${formatCount(contest.participants)}명`,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      color: "from-emerald-400 to-emerald-600",
    },
    {
      label: "카테고리",
      value: contest.category,
      icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
      color: "from-violet-400 to-violet-600",
    },
  ];

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 ${!isExpired ? "pb-28 sm:pb-10" : ""}`}>
      {/* Top bar: Back + actions — sticky below site header */}
      <div
        className="sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-3 bg-[#f8fafc]/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100/80 dark:border-gray-800/50 flex items-center justify-between"
        style={{ top: "var(--header-h, 64px)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all bg-transparent border-none cursor-pointer text-sm font-semibold group hover:gap-3 flex-shrink-0"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">목록으로 돌아가기</span>
          </button>
          {showStickyTitle && (
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate max-w-[200px] sm:max-w-xs animate-fade-in">
              {contest.title}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isExpired && (
            <button
              onClick={handleParticipate}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-xl shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-300 hover:-translate-y-0.5 transition-all no-underline text-sm"
            >
              공모전 참가
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
          <button
            onClick={handleShare}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all bg-transparent border-none cursor-pointer ${
              isCopied
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            {isCopied ? "복사됨" : "공유"}
          </button>
          <button
            onClick={() => { onToggleBookmark(contest.id); onToast?.(isBookmarked ? "북마크 해제됨" : "북마크에 추가됨 🔖"); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all bg-transparent border-none cursor-pointer ${
              isBookmarked
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
          >
            <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {isBookmarked ? "저장됨" : "저장"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="min-w-0 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl shadow-gray-200/50 dark:shadow-none animate-fade-in-up">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className={`absolute inset-0 ${
            isExpired
              ? "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
              : "bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950"
          }`} />
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-6">
              {logoError ? (
                <div className={`w-16 h-16 rounded-2xl border-2 border-white/20 shadow-xl flex items-center justify-center text-white font-black text-2xl select-none ${isExpired ? "bg-white/20" : "bg-amber-500/80"}`}>
                  {contest.company.charAt(0)}
                </div>
              ) : (
                <img
                  src={contest.logo}
                  alt={contest.company}
                  className={`w-16 h-16 rounded-2xl border-2 border-white/20 shadow-xl ${isExpired ? "grayscale" : ""}`}
                  onError={() => setLogoError(true)}
                />
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white/70 text-sm font-semibold">
                    {contest.company}
                  </p>
                  {isExpired && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white/70">
                      마감됨
                    </span>
                  )}
                  {isUrgent && !isExpired && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-500/80 text-white">
                      마감임박
                    </span>
                  )}
                  {!isExpired && (() => {
                    const ratio = contest.prizeAmount / (contest.participants || 1);
                    if (ratio > 10000) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/80 text-white">경쟁↓</span>;
                    if (ratio >= 5000) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-500/80 text-white">경쟁↑</span>;
                    return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-500/70 text-white">경쟁↑↑</span>;
                  })()}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight [word-break:keep-all]">
                  {contest.title}
                </h1>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              {infoCards.map((card, i) => (
                <div
                  key={i}
                  className="bg-white/[0.08] backdrop-blur-md rounded-2xl px-4 py-4 border border-white/10 animate-fade-in-up"
                  style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                      </svg>
                    </div>
                    <p className="text-[11px] text-white/50 font-semibold uppercase tracking-wide">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-white leading-snug">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* D-day 진행 바 — hero 최하단 */}
        <div
          className="h-1 bg-white/10 w-full"
          role="progressbar"
          aria-valuenow={Math.round(heroProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={isExpired ? "마감됨" : `D-${daysLeft} 남음`}
        >
          <div
            className={`h-full ${heroBarColor} transition-all duration-1000`}
            style={{ width: `${heroProgress}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 sm:p-10">
          {/* Prize Podium */}
          <div className="mb-10 animate-fade-in-up delay-150">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                시상 내역
              </h2>
            </div>
            <div className="flex gap-3 pl-10">
              {prizeBreakdown.map((p, i) => {
                const styles = [
                  {
                    wrap: "bg-gradient-to-b from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 border border-yellow-200 dark:border-yellow-800/50",
                    rank: "text-yellow-600 dark:text-yellow-400",
                    icon: "🥇",
                    amount: "text-gray-900 dark:text-white text-lg",
                  },
                  {
                    wrap: "bg-gradient-to-b from-gray-50 to-slate-50 dark:from-gray-800/60 dark:to-slate-800/30 border border-gray-200 dark:border-gray-700",
                    rank: "text-gray-500 dark:text-gray-400",
                    icon: "🥈",
                    amount: "text-gray-700 dark:text-gray-300 text-base",
                  },
                  {
                    wrap: "bg-gradient-to-b from-amber-50/60 to-orange-50/40 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/60 dark:border-amber-800/40",
                    rank: "text-amber-600 dark:text-amber-500",
                    icon: "🥉",
                    amount: "text-gray-600 dark:text-gray-400 text-sm",
                  },
                ][i] || {
                  wrap: "bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700",
                  rank: "text-gray-400",
                  icon: "🏅",
                  amount: "text-gray-600 dark:text-gray-400 text-sm",
                };
                return (
                  <div key={i} className={`flex-1 rounded-2xl px-4 py-4 text-center ${styles.wrap}`}>
                    <span className="text-2xl mb-1 block">{styles.icon}</span>
                    <p className={`font-extrabold leading-tight mb-0.5 ${styles.amount}`}>
                      {p.amount}
                    </p>
                    <p className={`text-xs font-bold ${styles.rank}`}>{p.rank}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mb-10 animate-fade-in-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                공모전 설명
              </h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[15px] pl-10">
              {contest.description}
            </p>
          </div>

          {/* Requirements */}
          <div className="mb-10 animate-fade-in-up delay-300">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                참여 조건
              </h2>
            </div>
            <ul className="space-y-3 pl-10">
              {contest.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3 animate-slide-in-right" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                  <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-400 text-gray-950 rounded-lg flex items-center justify-center text-xs font-black shadow-sm">
                    {i + 1}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 text-[15px] leading-relaxed pt-0.5">
                    {req}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Participation checklist */}
          <div className="mb-10 animate-fade-in-up delay-300">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-8 0h8m-8 0H5a2 2 0 01-2-2V7a2 2 0 012-2h3m8 12h3a2 2 0 002-2V7a2 2 0 00-2-2h-3M8 5a2 2 0 012-2h4a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                참가 전 확인
              </h2>
            </div>
            <div className="pl-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ["참가 포인트", "링크 제출 시 1,000P가 사용됩니다."],
                ["제출 링크", "업로드한 SNS 링크를 첨부하면 랭킹에 반영됩니다."],
                ["참고자료", "아래 자료 다운로드에서 제작에 필요한 파일을 확인하세요."],
              ].map(([title, value]) => (
                <div key={title} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">{title}</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile sticky CTA */}
          {!isExpired && (
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
              <button
                onClick={handleParticipate}
                className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-950 font-extrabold rounded-2xl shadow-lg shadow-amber-500/25 no-underline text-base"
              >
                공모전 참가 / 링크 첨부
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          )}

          {/* 비슷한 공모전 */}
          {(() => {
            const now = new Date();
            const sameCategory = contests
              .filter(c => c.id !== contest.id && c.category === contest.category && new Date(c.deadline) > now)
              .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            const others = contests
              .filter(c => c.id !== contest.id && c.category !== contest.category && new Date(c.deadline) > now)
              .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            const related = [...sameCategory, ...others].slice(0, 3);
            if (related.length === 0) return null;
            const isSameCategory = sameCategory.length > 0;
            return (
              <div className="mb-10 animate-fade-in-up delay-300">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    {isSameCategory ? "비슷한 공모전" : "다른 공모전도 보기"}
                  </h2>
                  {isSameCategory && <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">— {contest.category}</span>}
                </div>
                <div className="space-y-3 pl-10">
                  {related.map((c) => {
                    const dLeft = Math.ceil((new Date(c.deadline) - now) / (1000 * 60 * 60 * 24));
                    return (
                      <button
                        key={c.id}
                        onClick={() => onSelect?.(c)}
                        className={`w-full text-left flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-2xl border transition-all cursor-pointer group ${
                          dLeft <= 3
                            ? "border-red-100 dark:border-red-900/40 hover:border-red-200 dark:hover:border-red-800/50"
                            : "border-gray-100 dark:border-gray-800 hover:border-amber-200 dark:hover:border-amber-800/50"
                        } ${getStoredVisited().includes(c.id) ? "opacity-50 hover:opacity-90" : ""
                        }`}
                      >
                        <RelatedLogo contest={c} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                            {c.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{c.company}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className={`text-xs font-extrabold ${
                              dLeft <= 1 ? "text-red-600 dark:text-red-400" :
                              dLeft <= 3 ? "text-red-500 dark:text-red-400" :
                              dLeft <= 7 ? "text-orange-500 dark:text-orange-400" :
                              "text-amber-600 dark:text-amber-400"
                            }`}>
                              {dLeft === 1 ? "내일!" : `D-${dLeft}`}
                            </div>
                            <div className="text-[10px] text-gray-300 dark:text-gray-600 font-medium">
                              {(() => {
                                const d = new Date(c.deadline);
                                const m = d.getMonth() + 1;
                                const day = d.getDate();
                                const w = ["일","월","화","수","목","금","토"][d.getDay()];
                                return `${m}/${day}(${w})`;
                              })()}
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-amber-500 dark:text-amber-400">
                            {(c.prizeAmount / 10000).toLocaleString()}만원
                          </span>
                          <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Download / Expired notice */}
          {isExpired ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 animate-fade-in-up delay-400">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-500 dark:text-gray-400">마감된 공모전</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                      이 공모전은 {contest.deadline}에 마감되었습니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onBack}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-2xl shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-300 hover:-translate-y-0.5 transition-all text-sm cursor-pointer border-none whitespace-nowrap flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  진행중인 공모전 보기
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50/50 to-amber-50 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-amber-900/20 rounded-3xl p-6 sm:p-8 border border-amber-100 dark:border-amber-800/50 animate-fade-in-up delay-400">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                      홍보 소재 다운로드
                    </h2>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed pl-10">
                    노션 링크에서 공모전에 필요한 이미지, 영상 등 홍보 소재를 다운로드할 수 있습니다.
                  </p>
                </div>
                <a
                  href={contest.notionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-7 py-4 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-2xl shadow-lg shadow-amber-500/30 hover:from-amber-300 hover:to-yellow-300 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all no-underline flex-shrink-0"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.726l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM2.83 1.634l13.728-.933c1.682-.14 2.102.093 2.802.607l3.876 2.724c.466.326.606.746.606 1.26l-.047 15.036c0 .84-.326 1.494-1.494 1.587L7.075 22.848c-.886.046-1.306-.093-1.773-.7L2.35 18.13c-.513-.7-.746-1.213-.746-1.867V3.1c0-.84.326-1.4 1.168-1.493z" />
                  </svg>
                  노션에서 다운로드
                </a>
              </div>
            </div>
          )}

          {/* 하단 뒤로가기 — 모든 컨텐츠를 읽은 후 맨 아래 */}
          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 animate-fade-in-up">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all bg-transparent border-none cursor-pointer group"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
      <ParticipantLeaderboard
        contestId={contest.id}
        authSession={authSession}
        refreshKey={leaderboardRefresh}
        onSubmitClick={() => setEntryDialogOpen(true)}
        onRequireLogin={onRequireLogin}
      />
      </div>
      <EntrySubmitDialog
        open={entryDialogOpen}
        contest={contest}
        authSession={authSession}
        pointAccount={pointAccount}
        onClose={() => setEntryDialogOpen(false)}
        onSubmitted={() => setLeaderboardRefresh((value) => value + 1)}
        onToast={onToast}
      />
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import ContestCard from "./ContestCard";
import { categories } from "../data/contests";

function UrgentLogo({ contest }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
        {contest.company.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={contest.logo}
      alt={contest.company}
      className="w-9 h-9 rounded-xl shadow-sm flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

const CHIP_BASE = "inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-lg border border-amber-200 dark:border-amber-800/50";
const CHIP_X = "ml-0.5 text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 bg-transparent border-none cursor-pointer p-0 leading-none";

// 카테고리별 활성 탭 accent 색상
const categoryActiveStyle = {
  "전체":      "bg-amber-500 text-white shadow-lg shadow-amber-500/25",
  "SNS 마케팅": "bg-blue-500 text-white shadow-lg shadow-blue-500/25",
  "리뷰 콘텐츠": "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25",
  "인스타그램":  "bg-pink-500 text-white shadow-lg shadow-pink-500/25",
  "유튜브":    "bg-red-600 text-white shadow-lg shadow-red-500/25",
  "틱톡":     "bg-violet-600 text-white shadow-lg shadow-violet-500/25",
  "멀티 채널": "bg-amber-500 text-white shadow-lg shadow-amber-500/25",
};

function XIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function FilterChips({ activeCategory, searchQuery, showBookmarkedOnly, onClearCategory, onClearSearch, onClearBookmark, onClearAll }) {
  const activeCount = [searchQuery, activeCategory !== "전체", showBookmarkedOnly].filter(Boolean).length;
  return (
    <div className="mb-5 flex items-center gap-2 flex-wrap animate-fade-in">
      {activeCategory !== "전체" && (
        <span className={CHIP_BASE}>
          {activeCategory}
          <button onClick={onClearCategory} className={CHIP_X} aria-label="카테고리 필터 해제"><XIcon /></button>
        </span>
      )}
      {searchQuery && (
        <span className={CHIP_BASE}>
          "{searchQuery}"
          <button onClick={onClearSearch} className={CHIP_X} aria-label="검색어 초기화"><XIcon /></button>
        </span>
      )}
      {showBookmarkedOnly && (
        <span className={CHIP_BASE}>
          저장한 것만
          <button onClick={onClearBookmark} className={CHIP_X} aria-label="북마크 필터 해제"><XIcon /></button>
        </span>
      )}
      {activeCount >= 2 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 bg-transparent border-none cursor-pointer font-medium underline underline-offset-2 transition-colors"
        >
          모두 초기화
        </button>
      )}
    </div>
  );
}

export default function ContestList({ contests, onSelect, bookmarks, onToggleBookmark, onToast }) {
  const [activeCategory, setActiveCategory] = useState(() => {
    try { return sessionStorage.getItem("ph-category") || "전체"; } catch { return "전체"; }
  });
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem("ph-sort") || "deadline"; } catch { return "deadline"; }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return sessionStorage.getItem("ph-search") || ""; } catch { return ""; }
  });
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const searchRef = useRef(null);
  const searchWrapRef = useRef(null);
  const tabsScrollRef = useRef(null);
  const [tabsAtStart, setTabsAtStart] = useState(true);

  // 검색어·카테고리 세션 보존 — 카드 열고 뒤로가면 복원됨
  useEffect(() => {
    try { sessionStorage.setItem("ph-search", searchQuery); } catch {}
  }, [searchQuery]);
  useEffect(() => {
    try { sessionStorage.setItem("ph-category", activeCategory); } catch {}
  }, [activeCategory]);
  useEffect(() => {
    try { localStorage.setItem("ph-sort", sortBy); } catch {}
  }, [sortBy]);

  // 카테고리 탭 스크롤 위치 추적 (왼쪽 fade 표시용)
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const onScroll = () => setTabsAtStart(el.scrollLeft < 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // "/" 키로 검색창 포커스, Escape로 검색 초기화
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          setSearchQuery("");
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions]);

  const now = new Date();

  // 마감임박 (D-3 이내, 아직 진행중)
  const urgentContests = contests.filter((c) => {
    const daysLeft = Math.ceil((new Date(c.deadline) - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 3;
  });

  const filtered = contests
    .filter((c) => {
      const matchCategory = activeCategory === "전체" || c.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      const matchBookmark = !showBookmarkedOnly || bookmarks.includes(c.id);
      const isExpiredC = new Date(c.deadline) <= now;
      const matchExpired = showExpired || !isExpiredC;
      return matchCategory && matchSearch && matchBookmark && matchExpired;
    })
    .sort((a, b) => {
      const aExpired = new Date(a.deadline) <= now;
      const bExpired = new Date(b.deadline) <= now;
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;

      if (sortBy === "deadline") return new Date(a.deadline) - new Date(b.deadline);
      if (sortBy === "prize") return b.prizeAmount - a.prizeAmount;
      if (sortBy === "participants") return b.participants - a.participants;
      return 0;
    });

  const categoryIcons = {
    "전체": "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    "SNS 마케팅": "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    "리뷰 콘텐츠": "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    "인스타그램": "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    "유튜브": "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    "틱톡": "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    "멀티 채널": "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const totalExpiredCount = contests.filter(c => new Date(c.deadline) <= now).length;
  const expiredCount = filtered.filter(c => new Date(c.deadline) <= now).length;

  // 검색 자동완성 서제스천 (최대 5개)
  const suggestions = searchQuery.length > 0
    ? contests.filter(c => {
        const q = searchQuery.toLowerCase();
        return c.title.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
      }).slice(0, 5)
    : [];

  const handleSearchKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && suggestionIdx >= 0) {
      e.preventDefault();
      onSelect(suggestions[suggestionIdx]);
      setShowSuggestions(false);
      setSearchQuery("");
      setSuggestionIdx(-1);
    }
  };

  // 각 카테고리의 현재 필터(검색·북마크·마감포함) 기반 건수
  const getCategoryCount = (cat) =>
    contests.filter((c) => {
      if (cat !== "전체" && c.category !== cat) return false;
      const q = searchQuery.toLowerCase();
      if (q && !c.title.toLowerCase().includes(q) && !c.company.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      if (showBookmarkedOnly && !bookmarks.includes(c.id)) return false;
      if (!showExpired && new Date(c.deadline) <= now) return false;
      return true;
    }).length;

  return (
    <section id="contests" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

      {/* 마감임박 배너 */}
      {urgentContests.length > 0 && !searchQuery && activeCategory === "전체" && (
        <div className="mb-10 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <h3 className="text-sm font-extrabold text-red-600 dark:text-red-400 uppercase tracking-widest">
              마감임박
            </h3>
            <span className="text-xs text-red-400 dark:text-red-500 font-medium">
              — D-3 이내 마감
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {urgentContests.map((contest) => {
              const daysLeft = Math.ceil((new Date(contest.deadline) - now) / (1000 * 60 * 60 * 24));
              return (
                <button
                  key={contest.id}
                  onClick={() => onSelect(contest)}
                  className="flex-shrink-0 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer text-left group"
                >
                  <UrgentLogo contest={contest} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[160px] group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {contest.title}
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400 font-extrabold">
                      {daysLeft === 1 ? "내일 마감!" : `D-${daysLeft}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-1">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded-lg whitespace-nowrap">
                      {(contest.prizeAmount / 10000).toLocaleString()}만원
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <h2
            key={showExpired ? "all" : "active"}
            className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight animate-fade-in"
          >
            {showExpired ? "전체 공모전" : "진행중인 공모전"}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 mt-1.5 text-sm sm:text-base">
            참여하고 싶은 공모전을 선택하세요
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* 무작위 공모전 */}
          <button
            onClick={() => {
              const active = contests.filter(c => new Date(c.deadline) > now);
              if (active.length > 0) onSelect(active[Math.floor(Math.random() * active.length)]);
            }}
            title="무작위 공모전 열기"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-800/50 shadow-sm"
          >
            🎲 <span className="hidden sm:inline">랜덤</span>
          </button>

          {/* 마감 포함 토글 */}
          {totalExpiredCount > 0 && (
            <button
              onClick={() => setShowExpired((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer ${
                showExpired
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              마감 포함{showExpired && ` (${totalExpiredCount})`}
            </button>
          )}

          {/* 북마크 필터 토글 */}
          <button
            onClick={() => setShowBookmarkedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer ${
              showBookmarkedOnly
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
            }`}
          >
            <svg className="w-4 h-4" fill={showBookmarkedOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            저장{bookmarks.length > 0 && ` (${bookmarks.length})`}
          </button>

          {/* Sort pills */}
          {[
            { value: "deadline", short: "임박순", label: "마감 임박순", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
            { value: "prize", short: "상금순", label: "상금 높은순", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            { value: "participants", short: "참여순", label: "참여자 많은순", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
          ].map(({ value, short, label, icon }) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              title={label}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap ${
                sortBy === value
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search input + autocomplete */}
      <div ref={searchWrapRef} className="relative z-50 mb-6 animate-fade-in-up">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ zIndex: 1 }}>
          <svg
            className={`w-4 h-4 transition-colors duration-200 ${
              searchFocused || searchQuery
                ? "text-amber-500 dark:text-amber-400"
                : "text-gray-400"
            }`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); setSuggestionIdx(-1); }}
          onFocus={() => { setSearchFocused(true); if (searchQuery) setShowSuggestions(true); }}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={handleSearchKeyDown}
          placeholder="공모전 이름, 기업명 검색…"
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
          className="w-full pl-10 pr-20 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition-shadow"
        />

        {/* Autocomplete — 결과 없음 */}
        {showSuggestions && searchFocused && searchQuery.length > 0 && suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="px-4 py-4 flex items-center gap-3">
              <span className="text-xl flex-shrink-0 select-none">🦆</span>
              <div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  <span className="text-gray-700 dark:text-gray-200">"{searchQuery}"</span> 검색 결과 없음
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">다른 키워드로 검색해보세요</p>
              </div>
            </div>
          </div>
        )}

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
            {suggestions.map((contest, i) => {
              const q = searchQuery.toLowerCase();
              const isActive = i === suggestionIdx;
              return (
                <button
                  key={contest.id}
                  onMouseDown={(e) => { e.preventDefault(); onSelect(contest); setShowSuggestions(false); setSearchQuery(""); setSuggestionIdx(-1); }}
                  onMouseEnter={() => setSuggestionIdx(i)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 bg-transparent border-none cursor-pointer transition-colors ${
                    isActive ? "bg-amber-50 dark:bg-amber-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  } ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}
                >
                  <img
                    src={contest.logo}
                    alt=""
                    className="w-6 h-6 rounded-lg flex-shrink-0 object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? "text-amber-700 dark:text-amber-300" : "text-gray-700 dark:text-gray-300"}`}>
                      {contest.title}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{contest.company}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              title="지우기 (ESC)"
              aria-label="검색어 지우기"
              className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-transparent border-none cursor-pointer p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Category tabs — sticky below header */}
      <div className="sticky top-16 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50 mb-6">
        <div className="relative max-w-7xl mx-auto">
        <div ref={tabsScrollRef} className="flex gap-2 overflow-x-auto py-3 scrollbar-hide animate-fade-in-up delay-100">
          {categories.map((cat) => {
            const count = getCategoryCount(cat);
            return (
              <button
                key={cat}
                onClick={(e) => {
                  setActiveCategory(cat);
                  e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                  // 다른 카테고리로 이동 시 목록 상단이 보이도록 스크롤
                  if (cat !== activeCategory) {
                    const section = document.getElementById("contests");
                    if (section) {
                      const rect = section.getBoundingClientRect();
                      if (rect.top < 60) {
                        window.scrollTo({ top: section.offsetTop - 60, behavior: "smooth" });
                      }
                    }
                  }
                }}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer ${
                  activeCategory === cat
                    ? categoryActiveStyle[cat] || "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                    : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-sm"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={categoryIcons[cat] || categoryIcons["전체"]} />
                </svg>
                {cat}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center ${
                    activeCategory === cat
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* 오른쪽 fade-out — 더 많은 탭이 있다는 시각적 힌트 */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#f8fafc] dark:from-gray-950 to-transparent pointer-events-none" />
        {/* 왼쪽 fade-out — 스크롤 후 왼쪽에 탭이 있음을 표시 */}
        <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#f8fafc] dark:from-gray-950 to-transparent pointer-events-none transition-opacity duration-300 ${tabsAtStart ? "opacity-0" : "opacity-100"}`} />
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3 animate-fade-in flex items-center gap-3 flex-wrap" aria-live="polite" aria-atomic="true">
        <span key={filtered.length} className="text-sm text-gray-400 dark:text-gray-500 font-medium animate-fade-in">
          {filtered.length}개의 공모전
        </span>
        {expiredCount > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-md font-medium">
            마감 {expiredCount}개 포함
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {(searchQuery || activeCategory !== "전체" || showBookmarkedOnly) && (
        <FilterChips
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          showBookmarkedOnly={showBookmarkedOnly}
          onClearCategory={() => setActiveCategory("전체")}
          onClearSearch={() => setSearchQuery("")}
          onClearBookmark={() => setShowBookmarkedOnly(false)}
          onClearAll={() => { setSearchQuery(""); setActiveCategory("전체"); setShowBookmarkedOnly(false); }}
        />
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="text-6xl mb-4 animate-float" style={{ animationDelay: "0.1s" }}>🦆</div>
          <p className="text-gray-700 dark:text-gray-300 text-lg font-bold mb-1">
            {showBookmarkedOnly
              ? "저장한 공모전이 없어요"
              : searchQuery
              ? `"${searchQuery}" 검색 결과가 없어요`
              : "해당 카테고리에 진행중인 공모전이 없어요"}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {showBookmarkedOnly
              ? "마음에 드는 공모전을 북마크해 보세요 🔖"
              : searchQuery
              ? "다른 키워드로 검색하거나 필터를 바꿔보세요"
              : "다른 카테고리를 선택하거나 마감 포함 보기를 켜보세요"}
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-amber-600 dark:text-amber-400 hover:underline bg-transparent border-none cursor-pointer font-semibold"
              >
                검색어 초기화
              </button>
            )}
            {showBookmarkedOnly && (
              <button
                onClick={() => setShowBookmarkedOnly(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-xl shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-300 hover:-translate-y-0.5 transition-all text-sm cursor-pointer border-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                전체 공모전 탐색하기
              </button>
            )}
            {!showExpired && totalExpiredCount > 0 && !showBookmarkedOnly && (
              <button
                onClick={() => setShowExpired(true)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:underline bg-transparent border-none cursor-pointer font-medium"
              >
                마감된 공모전 보기 ({totalExpiredCount})
              </button>
            )}
          </div>
        </div>
      ) : (
        (() => {
          const activeFiltered = filtered.filter(c => new Date(c.deadline) > now);
          const expiredFiltered = filtered.filter(c => new Date(c.deadline) <= now);
          const renderCard = (contest, i) => (
            <ContestCard
              key={`${contest.id}-${sortBy}-${activeCategory}`}
              contest={contest}
              onClick={onSelect}
              index={i}
              isBookmarked={bookmarks.includes(contest.id)}
              onToggleBookmark={onToggleBookmark}
              onToast={onToast}
              searchQuery={searchQuery}
              onCategoryClick={setActiveCategory}
            />
          );
          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {activeFiltered.map((contest, i) => renderCard(contest, i))}
              </div>

              {showExpired && expiredFiltered.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mt-12 mb-7 animate-fade-in">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                    <div className="flex items-center gap-2 px-3">
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest whitespace-nowrap">
                        마감된 공모전 ({expiredFiltered.length})
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {expiredFiltered.map((contest, i) => renderCard(contest, activeFiltered.length + i))}
                  </div>
                </>
              )}
            </>
          );
        })()
      )}
    </section>
  );
}

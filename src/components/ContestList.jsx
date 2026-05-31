import { useState, useEffect, useRef } from "react";
import ContestCard from "./ContestCard";
import { categories } from "../data/contests";
import { getStoredItem, setStoredItem, removeStoredItem, STORAGE_KEYS, LEGACY_STORAGE_KEYS } from "../storageKeys";

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

function RecentLogo({ contest }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
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

function FilterChips({ activeCategory, searchQuery, showBookmarkedOnly, showUnvisitedOnly, minPrize, onClearCategory, onClearSearch, onClearBookmark, onClearUnvisited, onClearMinPrize, onClearAll }) {
  const activeCount = [searchQuery, activeCategory !== "전체", showBookmarkedOnly, showUnvisitedOnly, minPrize > 0].filter(Boolean).length;
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
      {showUnvisitedOnly && (
        <span className={CHIP_BASE}>
          안 본 것만
          <button onClick={onClearUnvisited} className={CHIP_X} aria-label="미확인 필터 해제"><XIcon /></button>
        </span>
      )}
      {minPrize > 0 && (
        <span className={CHIP_BASE}>
          상금 {minPrize / 10000}만원+
          <button onClick={onClearMinPrize} className={CHIP_X} aria-label="상금 필터 해제"><XIcon /></button>
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
    return getStoredItem(sessionStorage, STORAGE_KEYS.category, LEGACY_STORAGE_KEYS.category) || "전체";
  });
  const [visitedIds, setVisitedIds] = useState(() => {
    try { return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.visited, LEGACY_STORAGE_KEYS.visited) || "[]"); } catch { return []; }
  });
  const [sortBy, setSortBy] = useState(() => {
    return getStoredItem(localStorage, STORAGE_KEYS.sort, LEGACY_STORAGE_KEYS.sort) || "deadline";
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return getStoredItem(sessionStorage, STORAGE_KEYS.search, LEGACY_STORAGE_KEYS.search) || "";
  });
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [showUnvisitedOnly, setShowUnvisitedOnly] = useState(false);
  const [minPrize, setMinPrize] = useState(0);
  const [showExpired, setShowExpired] = useState(false);
  const [quickTab, setQuickTab] = useState("urgent");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const searchRef = useRef(null);
  const searchWrapRef = useRef(null);
  const tabsScrollRef = useRef(null);
  const [tabsAtStart, setTabsAtStart] = useState(true);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.recentSearches, LEGACY_STORAGE_KEYS.recentSearches) || "[]"); } catch { return []; }
  });

  // 검색어·카테고리 세션 보존 — 카드 열고 뒤로가면 복원됨
  useEffect(() => {
    setStoredItem(sessionStorage, STORAGE_KEYS.search, searchQuery);
  }, [searchQuery]);
  useEffect(() => {
    setStoredItem(sessionStorage, STORAGE_KEYS.category, activeCategory);
  }, [activeCategory]);
  useEffect(() => {
    setStoredItem(localStorage, STORAGE_KEYS.sort, sortBy);
  }, [sortBy]);

  // 카테고리 탭 스크롤 위치 추적 (왼쪽 fade 표시용)
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const onScroll = () => setTabsAtStart(el.scrollLeft < 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 세션 복원 시 활성 카테고리 탭이 보이도록 스크롤
  useEffect(() => {
    if (activeCategory === "전체") return;
    const el = tabsScrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`button[data-cat="${activeCategory}"]`);
    if (activeBtn) {
      requestAnimationFrame(() => {
        activeBtn.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 방문 인터셉트 — localStorage 영구 저장
  const handleSelect = (contest) => {
    setVisitedIds((prev) => {
      if (prev.includes(contest.id)) return prev;
      const next = [...prev, contest.id];
      setStoredItem(localStorage, STORAGE_KEYS.visited, JSON.stringify(next));
      return next;
    });
    onSelect(contest);
  };

  const handleClearVisited = () => {
    removeStoredItem(localStorage, STORAGE_KEYS.visited, LEGACY_STORAGE_KEYS.visited);
    setVisitedIds([]);
    setShowUnvisitedOnly(false);
    onToast?.("방문 기록이 초기화됐어요 ✓");
  };

  const saveRecentSearch = (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== trimmed);
      const next = [trimmed, ...filtered].slice(0, 5);
      setStoredItem(localStorage, STORAGE_KEYS.recentSearches, JSON.stringify(next));
      return next;
    });
  };

  const removeRecentSearch = (term) => {
    setRecentSearches(prev => {
      const next = prev.filter(s => s !== term);
      setStoredItem(localStorage, STORAGE_KEYS.recentSearches, JSON.stringify(next));
      return next;
    });
  };

  // 최신 2개 공모전 (id 내림차순 상위 2)
  const newIds = [...contests].sort((a, b) => b.id - a.id).slice(0, 2).map((c) => c.id);

  const now = new Date();

  // 마감임박 (D-3 이내, 아직 진행중) + minPrize 반영
  const urgentContests = contests.filter((c) => {
    const daysLeft = Math.ceil((new Date(c.deadline) - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 3 && (!minPrize || c.prizeAmount >= minPrize);
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
      const matchUnvisited = !showUnvisitedOnly || !visitedIds.includes(c.id);
      const matchPrize = !minPrize || c.prizeAmount >= minPrize;
      const isExpiredC = new Date(c.deadline) <= now;
      const matchExpired = showExpired || !isExpiredC;
      return matchCategory && matchSearch && matchBookmark && matchUnvisited && matchExpired && matchPrize;
    })
    .sort((a, b) => {
      const aExpired = new Date(a.deadline) <= now;
      const bExpired = new Date(b.deadline) <= now;
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;

      if (sortBy === "deadline") return new Date(a.deadline) - new Date(b.deadline);
      if (sortBy === "prize") return b.prizeAmount - a.prizeAmount;
      if (sortBy === "participants") return b.participants - a.participants;
      if (sortBy === "competition") return (b.prizeAmount / (b.participants || 1)) - (a.prizeAmount / (a.participants || 1));
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
      handleSelect(suggestions[suggestionIdx]);
      setShowSuggestions(false);
      setSearchQuery("");
      setSuggestionIdx(-1);
    }
  };

  // 카드 카테고리 뱃지 클릭 → 탭 필터 변경 + 탭 영역 스크롤
  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    requestAnimationFrame(() => {
      const tabBtn = tabsScrollRef.current?.querySelector(`button[data-cat="${cat}"]`);
      tabBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  };

  // 각 카테고리의 현재 필터(검색·북마크·마감포함·상금범위) 기반 건수
  const getCategoryCount = (cat) =>
    contests.filter((c) => {
      if (cat !== "전체" && c.category !== cat) return false;
      const q = searchQuery.toLowerCase();
      if (q && !c.title.toLowerCase().includes(q) && !c.company.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      if (showBookmarkedOnly && !bookmarks.includes(c.id)) return false;
      if (showUnvisitedOnly && visitedIds.includes(c.id)) return false;
      if (!showExpired && new Date(c.deadline) <= now) return false;
      if (minPrize && c.prizeAmount < minPrize) return false;
      return true;
    }).length;

  {
    // h2Text — 필터 상태에 따라 동적으로 변함 (render 직전)
    // quickTab effectiveTab — urgentContests가 없으면 recent로 fallback
  }
  const h2Text = (() => {
    if (showExpired) return "전체 공모전";
    const parts = [];
    if (activeCategory !== "전체") parts.push(activeCategory);
    if (showBookmarkedOnly) parts.push("저장한 것만");
    if (showUnvisitedOnly) parts.push("안 본 것만");
    if (minPrize > 0) parts.push(`${minPrize / 10000}만원+`);
    if (searchQuery) parts.push(`"${searchQuery}"`);
    if (parts.length === 0) return "진행중인 공모전";
    return parts.join(" · ");
  })();

  const recentlyViewed = visitedIds.slice().reverse().slice(0, 3)
    .map(id => contests.find(c => c.id === id))
    .filter(c => c && new Date(c.deadline) > now);
  const showQuickAccess = !searchQuery && activeCategory === "전체";
  const hasBothBanners = urgentContests.length > 0 && recentlyViewed.length > 0;
  const effectiveTab = urgentContests.length > 0 ? quickTab : "recent";

  return (
    <section id="contests" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

      {/* Quick Access — 마감임박 + 최근확인 통합 블록 */}
      {showQuickAccess && (urgentContests.length > 0 || recentlyViewed.length > 0) && (
        <div className="mb-10 animate-fade-in-up">
          {/* 탭 헤더 — 둘 다 있을 때만 */}
          {hasBothBanners ? (
            <div className="flex items-center gap-1 mb-3">
              <button
                onClick={() => setQuickTab("urgent")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                  effectiveTab === "urgent"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : "bg-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  {effectiveTab === "urgent" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                마감임박 ({urgentContests.length})
              </button>
              <span className="text-gray-200 dark:text-gray-700 text-xs select-none">·</span>
              <button
                onClick={() => setQuickTab("recent")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                  effectiveTab === "recent"
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    : "bg-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                최근 확인
              </button>
            </div>
          ) : urgentContests.length > 0 ? (
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h3 className="text-sm font-extrabold text-red-600 dark:text-red-400 uppercase tracking-widest">마감임박</h3>
              <span className="text-xs text-red-400 dark:text-red-500 font-medium">— D-3 이내 마감</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold">최근 확인</h3>
            </div>
          )}

          {/* 컨텐츠 영역 */}
          <div className="relative">
            {effectiveTab === "urgent" && urgentContests.length > 0 && (
              <div key="urgent-content" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide animate-fade-in">
                {urgentContests.map((contest) => {
                  const daysLeft = Math.ceil((new Date(contest.deadline) - now) / (1000 * 60 * 60 * 24));
                  return (
                    <button
                      key={contest.id}
                      onClick={() => handleSelect(contest)}
                      className={`flex-shrink-0 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer text-left group ${
                        visitedIds.includes(contest.id) ? "opacity-50 hover:opacity-80" : ""
                      }`}
                    >
                      <UrgentLogo contest={contest} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[160px] group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {contest.title}
                        </p>
                        <div>
                          {daysLeft === 1 ? (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-white">내일까지!</span>
                          ) : (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-orange-500/90 text-white">D-{daysLeft} 마감</span>
                          )}
                        </div>
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
            )}
            {effectiveTab === "recent" && recentlyViewed.length > 0 && (
              <div key="recent-content" className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide animate-fade-in">
                {recentlyViewed.map((contest) => {
                  const daysLeft = Math.ceil((new Date(contest.deadline) - now) / (1000 * 60 * 60 * 24));
                  return (
                    <button
                      key={contest.id}
                      onClick={() => handleSelect(contest)}
                      className="flex-shrink-0 flex items-center gap-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer text-left group shadow-sm"
                    >
                      <RecentLogo contest={contest} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-[140px] group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                          {contest.title}
                        </p>
                        <div className="mt-0.5">
                          {daysLeft === 0 ? (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white animate-pulse-soft">오늘 마감!</span>
                          ) : daysLeft === 1 ? (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-white">내일까지!</span>
                          ) : daysLeft <= 3 ? (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-orange-500/90 text-white">D-{daysLeft} 마감</span>
                          ) : daysLeft <= 7 ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">D-{daysLeft}</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">D-{daysLeft}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="absolute top-0 right-0 bottom-2 w-12 bg-gradient-to-l from-[#f8fafc] dark:from-gray-950 to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              key={h2Text}
              className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight animate-fade-in"
            >
              {h2Text}
            </h2>
            {(() => {
              const activeContests = contests.filter(c => new Date(c.deadline) > now);
              const visitedActive = activeContests.filter(c => visitedIds.includes(c.id)).length;
              if (visitedActive === 0) return null;
              const pct = Math.round((visitedActive / activeContests.length) * 100);
              return (
                <button
                  onClick={() => setShowUnvisitedOnly(v => !v)}
                  title={showUnvisitedOnly ? "전체 보기로 전환" : "안 본 공모전만 보기"}
                  className={`flex items-center gap-2 animate-fade-in border-none cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 -my-1 transition-all ${
                    showUnvisitedOnly
                      ? "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700"
                      : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${showUnvisitedOnly ? "bg-amber-500" : "bg-amber-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium tabular-nums ${showUnvisitedOnly ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}>
                    {visitedActive}/{activeContests.length}
                  </span>
                </button>
              );
            })()}
          </div>
          <p className="text-gray-400 dark:text-gray-500 mt-1.5 text-sm sm:text-base">
            참여하고 싶은 공모전을 선택하세요
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5 sm:flex-wrap sm:justify-end">
          {/* 무작위 공모전 */}
          <button
            onClick={() => {
              const active = contests.filter(c => new Date(c.deadline) > now);
              if (active.length > 0) handleSelect(active[Math.floor(Math.random() * active.length)]);
            }}
            title="무작위 공모전 열기"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-800/50 shadow-sm"
          >
            🎲 <span className="hidden sm:inline">랜덤</span>
          </button>

          {/* 마감 포함 토글 */}
          {totalExpiredCount > 0 && (
            <button
              onClick={() => setShowExpired((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap ${
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
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap ${
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

          {/* 안 본 것만 토글 + 기록 초기화 */}
          {visitedIds.length > 0 && (
            <>
              <button
                onClick={() => setShowUnvisitedOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap ${
                  showUnvisitedOnly
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                    : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                안 본 것만
              </button>
              <button
                onClick={handleClearVisited}
                title="방문 기록 전체 초기화"
                className="inline-flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-medium text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border-none cursor-pointer whitespace-nowrap bg-transparent"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">기록 초기화</span>
              </button>
            </>
          )}

          {/* 상금 범위 퀵 필터 */}
          {[
            { label: "30만+", value: 300000 },
            { label: "100만+", value: 1000000 },
            { label: "300만+", value: 3000000 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setMinPrize(prev => prev === value ? 0 : value)}
              title={`${label}원 이상 공모전`}
              className={`inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-none cursor-pointer whitespace-nowrap ${
                minPrize === value
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
              }`}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {label}
            </button>
          ))}

          {/* 필터/정렬 구분선 */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" aria-hidden="true" />

          {/* Sort pills */}
          {[
            { value: "deadline", short: "임박순", label: "마감 임박순", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
            { value: "prize", short: "상금순", label: "상금 높은순", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            { value: "participants", short: "참여순", label: "참여자 많은순", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
            { value: "competition", short: "경쟁↓", label: "경쟁 낮은순", icon: "M19 14l-7 7m0 0l-7-7m7 7V3" },
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
          onFocus={() => { setSearchFocused(true); setShowSuggestions(true); }}
          onBlur={() => { setSearchFocused(false); saveRecentSearch(searchQuery); }}
          onKeyDown={handleSearchKeyDown}
          placeholder={activeCategory !== "전체" ? `${activeCategory} 공모전 검색…` : "공모전 이름, 기업명 검색…"}
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
          className="w-full pl-10 pr-24 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition-shadow"
        />
        {/* "/" 키 힌트 — 포커스·입력 없을 때만 */}
        {!searchFocused && !searchQuery && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none gap-1.5 animate-fade-in">
            <kbd className="text-[10px] text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 font-mono bg-gray-50 dark:bg-gray-800 leading-none">/</kbd>
          </div>
        )}

        {/* 최근 검색어 — 포커스 + 검색어 없음 + 기록 있음 */}
        {showSuggestions && searchFocused && !searchQuery && recentSearches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">최근 검색</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); setRecentSearches([]); removeStoredItem(localStorage, STORAGE_KEYS.recentSearches, LEGACY_STORAGE_KEYS.recentSearches); }}
                className="text-[10px] text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 bg-transparent border-none cursor-pointer transition-colors"
              >
                모두 삭제
              </button>
            </div>
            {recentSearches.map((term) => (
              <div key={term} className="flex items-center group border-t border-gray-50 dark:border-gray-800">
                <button
                  onMouseDown={(e) => { e.preventDefault(); setSearchQuery(term); setShowSuggestions(true); setSuggestionIdx(-1); }}
                  className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{term}</span>
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); removeRecentSearch(term); }}
                  className="p-3 text-gray-200 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all bg-transparent border-none cursor-pointer"
                  aria-label={`"${term}" 검색 기록 삭제`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

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
              const isActive = i === suggestionIdx;
              return (
                <button
                  key={contest.id}
                  onMouseDown={(e) => { e.preventDefault(); saveRecentSearch(searchQuery); handleSelect(contest); setShowSuggestions(false); setSearchQuery(""); setSuggestionIdx(-1); }}
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
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {contest.company} · <span className="text-amber-500 dark:text-amber-400 font-bold">{(contest.prizeAmount / 10000).toLocaleString()}만원</span>
                    </p>
                  </div>
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

      {/* Category tabs — sticky below header (top tracks --header-h CSS var) */}
      <div
        className="sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50 mb-6"
        style={{ top: "var(--header-h, 64px)", transition: "top 300ms ease" }}
      >
        <div className="relative max-w-7xl mx-auto">
        <div ref={tabsScrollRef} className="flex gap-2 overflow-x-auto py-3 scrollbar-hide animate-fade-in-up delay-100">
          {categories.map((cat) => {
            const count = getCategoryCount(cat);
            return (
              <button
                key={cat}
                data-cat={cat}
                onClick={(e) => {
                  const next = cat === "전체" ? "전체" : (activeCategory === cat ? "전체" : cat);
                  setActiveCategory(next);
                  e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                  // 다른 카테고리로 이동 시 목록 상단이 보이도록 스크롤
                  if (next !== activeCategory) {
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
                    : count === 0
                    ? "bg-white dark:bg-gray-900 text-gray-300 dark:text-gray-700 border border-gray-100 dark:border-gray-800 shadow-sm opacity-50"
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
          {(() => {
            const hasFilter = searchQuery || activeCategory !== "전체" || showBookmarkedOnly || showUnvisitedOnly || minPrize > 0;
            const activeTotal = contests.filter(c => new Date(c.deadline) > now).length;
            return hasFilter && !showExpired
              ? `전체 ${activeTotal}개 중 ${filtered.length}개`
              : `${filtered.length}개의 공모전`;
          })()}
        </span>
        {expiredCount > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-md font-medium">
            마감 {expiredCount}개 포함
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {(searchQuery || activeCategory !== "전체" || showBookmarkedOnly || showUnvisitedOnly || minPrize > 0) && (
        <FilterChips
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          showBookmarkedOnly={showBookmarkedOnly}
          showUnvisitedOnly={showUnvisitedOnly}
          minPrize={minPrize}
          onClearCategory={() => setActiveCategory("전체")}
          onClearSearch={() => setSearchQuery("")}
          onClearBookmark={() => setShowBookmarkedOnly(false)}
          onClearUnvisited={() => setShowUnvisitedOnly(false)}
          onClearMinPrize={() => setMinPrize(0)}
          onClearAll={() => { setSearchQuery(""); setActiveCategory("전체"); setShowBookmarkedOnly(false); setShowUnvisitedOnly(false); setMinPrize(0); }}
        />
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="text-6xl mb-4 animate-float" style={{ animationDelay: "0.1s" }}>
            {showUnvisitedOnly && !showBookmarkedOnly ? "🎉"
              : showUnvisitedOnly && showBookmarkedOnly ? "🎊"
              : showBookmarkedOnly ? "🔖"
              : searchQuery ? "🔍"
              : minPrize > 0 ? "💸"
              : "🦆"}
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-lg font-bold mb-1">
            {showUnvisitedOnly && !showBookmarkedOnly
              ? "모든 공모전을 다 확인했어요!"
              : showUnvisitedOnly && showBookmarkedOnly
              ? "저장한 공모전을 모두 확인했어요!"
              : showBookmarkedOnly
              ? "저장한 공모전이 없어요"
              : searchQuery
              ? `"${searchQuery}" 검색 결과가 없어요`
              : minPrize > 0
              ? `${(minPrize / 10000).toLocaleString()}만원 이상 공모전이 없어요`
              : "해당 카테고리에 진행중인 공모전이 없어요"}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {showUnvisitedOnly
              ? "놓친 공모전이 없는지 북마크를 확인해보세요 🔖"
              : showBookmarkedOnly
              ? "마음에 드는 공모전을 북마크해 보세요 🔖"
              : searchQuery
              ? "다른 키워드로 검색하거나 필터를 바꿔보세요"
              : "다른 카테고리를 선택하거나 마감 포함 보기를 켜보세요"}
          </p>
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-amber-600 dark:text-amber-400 hover:underline bg-transparent border-none cursor-pointer font-semibold"
              >
                검색어 초기화
              </button>
            )}
            {searchQuery && activeCategory !== "전체" && (
              <button
                onClick={() => setActiveCategory("전체")}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-transparent border-none cursor-pointer font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                전체 카테고리에서 검색
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
            {showUnvisitedOnly && (
              <button
                onClick={() => setShowUnvisitedOnly(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-xl shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-300 hover:-translate-y-0.5 transition-all text-sm cursor-pointer border-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                전체 공모전 보기
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
              onClick={handleSelect}
              index={i}
              isBookmarked={bookmarks.includes(contest.id)}
              onToggleBookmark={onToggleBookmark}
              onToast={onToast}
              searchQuery={searchQuery}
              onCategoryClick={handleCategoryClick}
              isNew={newIds.includes(contest.id)}
              isVisited={visitedIds.includes(contest.id)}
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

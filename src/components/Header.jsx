import { useState, useEffect, useRef } from "react";
import logoSrc from "../assets/adsduck-logo.png";

export default function Header({ onNavigate, currentPage, darkMode, onToggleDark }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 10);
      // 스크롤 다운 100px 이상 + 충분히 아래일 때만 숨김
      if (currentY > lastY + 6 && currentY > 120) {
        setHidden(true);
      } else if (currentY < lastY - 4) {
        setHidden(false);
      }
      lastY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 헤더 높이를 CSS 변수로 공유 — 카테고리 탭 sticky 위치에 사용
  useEffect(() => {
    const h = headerRef.current ? headerRef.current.offsetHeight : 64;
    document.documentElement.style.setProperty("--header-h", hidden ? "0px" : `${h}px`);
  }, [hidden]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // 스크롤 전: hero 그라디언트 위 → 흰색 텍스트
  // 스크롤 후: glass 배경 위 → 어두운 텍스트
  const isOverHero = !scrolled && currentPage === "home";

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        scrolled
          ? "glass border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm"
          : isOverHero
          ? "bg-gradient-to-r from-gray-950 via-gray-900 to-amber-950"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center cursor-pointer bg-transparent border-none group"
          >
            <img
              src={logoSrc}
              alt="AdsDuck"
              className="h-11 sm:h-12 w-auto transition-all duration-300 group-hover:opacity-85"
              style={{
                filter: (isOverHero || darkMode)
                  ? "brightness(0) invert(1)"
                  : "none",
              }}
            />
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <nav className="flex items-center gap-1">
              {[
                { key: "home", label: "공모전", active: true },
                { key: "ranking", label: "랭킹", disabled: true },
                { key: "mypage", label: "마이페이지", disabled: true },
              ].map((item) => (
                <div key={item.key} className="relative group/nav">
                  <button
                    onClick={() => !item.disabled && onNavigate(item.key)}
                    disabled={item.disabled}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-transparent border-none cursor-pointer ${
                      item.disabled
                        ? isOverHero
                          ? "text-white/30 cursor-not-allowed"
                          : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : currentPage === item.key
                        ? isOverHero
                          ? "bg-white/20 text-white"
                          : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        : isOverHero
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                    {item.disabled && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        isOverHero
                          ? "bg-white/10 text-white/40"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                      }`}>
                        SOON
                      </span>
                    )}
                  </button>
                  {item.disabled && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                      곧 출시 예정이에요 ☕
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Dark mode toggle */}
            <button
              onClick={onToggleDark}
              className={`ml-1 p-2 rounded-xl transition-all bg-transparent border-none cursor-pointer ${
                isOverHero
                  ? "text-white/80 hover:text-white hover:bg-white/10"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
              aria-label={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {darkMode ? (
                /* Sun icon */
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                /* Moon icon */
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile right buttons */}
          <div className="md:hidden flex items-center gap-1">
            {/* Dark mode toggle (mobile) */}
            <button
              onClick={onToggleDark}
              className={`p-2 rounded-xl transition-all bg-transparent border-none cursor-pointer ${
                isOverHero
                  ? "text-white/80 hover:text-white hover:bg-white/10"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              aria-label={darkMode ? "라이트 모드" : "다크 모드"}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Burger */}
            <button
              className={`p-2 rounded-xl bg-transparent border-none cursor-pointer transition-colors ${
                isOverHero
                  ? "text-white/80 hover:text-white hover:bg-white/10"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              onClick={() => { setMobileOpen(true); setHidden(false); }}
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 mobile-menu-overlay md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-72 bg-white dark:bg-gray-900 z-50 shadow-2xl mobile-menu-panel md:hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-lg font-bold text-gray-900 dark:text-white">메뉴</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-transparent border-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="메뉴 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-4 flex flex-col gap-1">
              {[
                { key: "home", label: "공모전", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
                { key: "ranking", label: "랭킹", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", disabled: true },
                { key: "mypage", label: "마이페이지", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", disabled: true },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (!item.disabled) {
                      onNavigate(item.key);
                      setMobileOpen(false);
                    }
                  }}
                  disabled={item.disabled}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-semibold transition-all bg-transparent border-none w-full ${
                    item.disabled
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : currentPage === item.key
                      ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 cursor-pointer"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.label}
                  {item.disabled && (
                    <span className="ml-auto text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">
                      SOON
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import logoSrc from "../assets/adsduck-logo-cropped.png";
import logoWhiteSrc from "../assets/adsduck-logo-white.png";

export default function Header({ onNavigate, currentPage, darkMode, onToggleDark, authSession, onOpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
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
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = (event) => {
      if (event.matches) {
        setMobileOpen(false);
        setHidden(false);
      }
    };

    if (desktopQuery.matches) closeOnDesktop(desktopQuery);
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const syncScrollLock = () => {
      document.body.style.overflow = mobileOpen && mobileQuery.matches ? "hidden" : "";
    };

    syncScrollLock();
    mobileQuery.addEventListener("change", syncScrollLock);
    return () => {
      mobileQuery.removeEventListener("change", syncScrollLock);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // 헤더 색상은 스크롤 위치와 무관하게 현재 테마를 따른다.
  const useDarkHeader = darkMode;
  const isAuthenticated = !!authSession?.isAuthenticated;
  const navItems = [
    { key: "home", label: "공모전", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { key: "organizer", label: "주최하기", icon: "M12 8v4l3 2m6-2a9 9 0 1 1 -18 0 9 9 0 0 1 18 0Z" },
    { key: "board", label: "게시판", icon: "M8 10h8M8 14h5m-9 6h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { key: "lectures", label: "AI강의레터", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" },
    ...(isAuthenticated
      ? [
          { key: "messages", label: "쪽지함", icon: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" },
          { key: "points", label: "포인트 충전", icon: "M21 12V7a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V8m15 6h.01" },
        ]
      : []),
  ];

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        mobileOpen ? "" : hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        useDarkHeader
          ? "bg-gray-950 border-b border-white/10"
          : "bg-white/95 border-b border-gray-200/70 shadow-sm backdrop-blur-xl"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          {/* Logo */}
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center cursor-pointer bg-transparent border-none group"
          >
            <img
              src={useDarkHeader ? logoWhiteSrc : logoSrc}
              alt="AdsDuck"
              className="h-7 w-auto object-contain transition-all duration-300 group-hover:opacity-85 sm:h-8"
            />
          </button>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <div key={item.key} className="relative group/nav">
                  <button
                    onClick={() => onNavigate(item.key)}
                    className={`rounded-md border-none bg-transparent px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer ${
                      currentPage === item.key
                        ? useDarkHeader
                          ? "bg-white/10 text-white"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : useDarkHeader
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </nav>

            {/* Dark mode toggle */}
            <button
              onClick={onToggleDark}
              className={`ml-1 rounded-md border-none bg-transparent p-1.5 transition-all cursor-pointer ${
                useDarkHeader
                  ? "text-white/80 hover:text-white hover:bg-white/10"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
              aria-label={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {darkMode ? (
                /* Sun icon */
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                /* Moon icon */
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className="ml-1 flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 dark:bg-gray-800/70">
                <span className={`text-xs font-bold max-w-[120px] truncate ${
                  useDarkHeader ? "text-white" : "text-gray-700 dark:text-gray-200"
                }`}>
                  {authSession.user?.display_name || authSession.user?.email || "사용자"}
                </span>
                <button
                  onClick={authSession.logout}
                  className={`text-[11px] font-bold bg-transparent border-none cursor-pointer ${
                    useDarkHeader ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="ml-1 flex items-center gap-1">
                <button
                  onClick={() => onOpenAuth?.("login")}
                  className={`rounded-md border-none px-3 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
                    useDarkHeader
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  로그인
                </button>
                <button
                  onClick={() => onOpenAuth?.("signup")}
                  className="rounded-md border-none bg-amber-400 px-3 py-1.5 text-sm font-bold text-gray-950 cursor-pointer hover:bg-amber-300"
                >
                  회원가입
                </button>
              </div>
            )}
          </div>

          {/* Mobile right buttons */}
          <div className="flex items-center gap-1 md:hidden">
            {/* Dark mode toggle (mobile) */}
            <button
              onClick={onToggleDark}
              className={`rounded-md border-none p-1.5 transition-all cursor-pointer ${
                useDarkHeader
                  ? "bg-white/10 text-white hover:text-white hover:bg-white/20"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-label={darkMode ? "라이트 모드" : "다크 모드"}
            >
              {darkMode ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Burger */}
            <button
              className={`rounded-md border-none p-1.5 transition-colors cursor-pointer ${
                useDarkHeader
                  ? "bg-white/10 text-white hover:text-white hover:bg-white/20"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => { setMobileOpen(true); setHidden(false); }}
              aria-label="메뉴 열기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[400] bg-white mobile-menu-overlay dark:bg-gray-900 md:hidden"
            style={{ backgroundColor: darkMode ? "#111827" : "#ffffff" }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed inset-0 z-[410] overflow-y-auto bg-white shadow-xl mobile-menu-panel dark:bg-gray-900 md:hidden"
            style={{ backgroundColor: darkMode ? "#111827" : "#ffffff", minHeight: "100dvh" }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
              <span className="text-base font-bold text-gray-900 dark:text-white">메뉴</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md border-none bg-transparent p-1.5 text-gray-400 transition-colors cursor-pointer hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="메뉴 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {isAuthenticated ? (
                <div className="mb-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800/60">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">로그인 계정</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                    {authSession.user?.display_name || authSession.user?.email || "사용자"}
                  </p>
                  <button
                    onClick={() => {
                      authSession.logout();
                      setMobileOpen(false);
                    }}
                    className="mt-3 text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-transparent border-none cursor-pointer p-0"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onOpenAuth?.("login");
                      setMobileOpen(false);
                    }}
                    className="rounded-md border border-gray-200 bg-transparent px-3 py-2.5 text-sm font-bold text-gray-700 cursor-pointer dark:border-gray-700 dark:text-gray-200"
                  >
                    로그인
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuth?.("signup");
                      setMobileOpen(false);
                    }}
                    className="rounded-md border-none bg-amber-400 px-3 py-2.5 text-sm font-bold text-gray-950 cursor-pointer"
                  >
                    회원가입
                  </button>
                </div>
              )}
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    onNavigate(item.key);
                    setMobileOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                    currentPage === item.key
                      ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 cursor-pointer"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </>,
        document.body
      )}
    </header>
  );
}

import { useState, useEffect } from "react";

export default function Header({ onNavigate, currentPage }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none group"
          >
            <div className="relative w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
              <span className="text-white font-extrabold text-sm tracking-tight">P</span>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-900" />
            </div>
            <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Promo<span className="gradient-text">Hub</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { key: "home", label: "공모전", active: true },
              { key: "ranking", label: "랭킹", disabled: true },
              { key: "mypage", label: "마이페이지", disabled: true },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => !item.disabled && onNavigate(item.key)}
                disabled={item.disabled}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-transparent border-none cursor-pointer ${
                  item.disabled
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : currentPage === item.key
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {item.label}
                {item.disabled && (
                  <span className="ml-1.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                    SOON
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-600 dark:text-gray-400 bg-transparent border-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 cursor-pointer"
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

import { useState, useEffect } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ContestList from "./components/ContestList";
import ContestDetail from "./components/ContestDetail";
import Terms from "./components/Terms";
import Footer from "./components/Footer";
import { ToastContainer, useToast } from "./components/Toast";
import ScrollToTop from "./components/ScrollToTop";
import { contests } from "./data/contests";
import { allTerms } from "./data/terms";

const TERMS_KEYS = new Set(allTerms.map((t) => t.key));
const DEFAULT_TERMS_KEY = "service";

export default function App() {
  const [page, setPage] = useState("home");
  const [selectedContest, setSelectedContest] = useState(null);
  const [termsSection, setTermsSection] = useState(DEFAULT_TERMS_KEY);
  const { toasts, addToast, removeToast } = useToast();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("ph-dark");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem("ph-bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 다크모드 적용
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("ph-dark", String(darkMode));
  }, [darkMode]);

  // 초기 history state 세팅 + URL 파라미터로 직접 공유 지원
  //  ?c=ID      → 콘테스트 상세
  //  ?terms=K   → 이용약관 (K: service | ad | contest)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const termsParam = params.get("terms");
    if (termsParam !== null) {
      const key = TERMS_KEYS.has(termsParam) ? termsParam : DEFAULT_TERMS_KEY;
      setTermsSection(key);
      setPage("terms");
      document.title = "이용약관 — AdsDuck";
      window.history.replaceState({ page: "terms", termsSection: key }, "");
      return;
    }
    const contestId = Number(params.get("c"));
    if (contestId) {
      const contest = contests.find((c) => c.id === contestId);
      if (contest) {
        setSelectedContest(contest);
        setPage("detail");
        document.title = `${contest.title} — AdsDuck`;
        window.history.replaceState({ page: "detail", contestId: contest.id }, "");
        return;
      }
    }
    window.history.replaceState({ page: "home" }, "");
  }, []);

  // 브라우저 뒤로가기 지원
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (!state || state.page === "home") {
        setPage("home");
        setSelectedContest(null);
      } else if (state.page === "detail" && state.contestId) {
        const contest = contests.find((c) => c.id === state.contestId);
        if (contest) {
          setSelectedContest(contest);
          setPage("detail");
        } else {
          setPage("home");
          setSelectedContest(null);
        }
      } else if (state.page === "terms") {
        const key = TERMS_KEYS.has(state.termsSection)
          ? state.termsSection
          : DEFAULT_TERMS_KEY;
        setTermsSection(key);
        setPage("terms");
        setSelectedContest(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const toggleBookmark = (contestId) => {
    setBookmarks((prev) => {
      const next = prev.includes(contestId)
        ? prev.filter((id) => id !== contestId)
        : [...prev, contestId];
      localStorage.setItem("ph-bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const handleSelect = (contest) => {
    sessionStorage.setItem("ph-scroll-y", String(window.scrollY));
    setSelectedContest(contest);
    setPage("detail");
    document.title = `${contest.title} — AdsDuck`;
    const url = `${window.location.pathname}?c=${contest.id}`;
    window.history.pushState({ page: "detail", contestId: contest.id }, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNavigate = (target, options = {}) => {
    // target이 "terms"일 때는 options.section으로 탭 지정 가능
    const nextTermsSection =
      target === "terms"
        ? TERMS_KEYS.has(options.section)
          ? options.section
          : termsSection || DEFAULT_TERMS_KEY
        : termsSection;

    if (page !== target || (target === "terms" && nextTermsSection !== termsSection)) {
      let nextUrl;
      if (target === "home") {
        nextUrl = window.location.pathname;
      } else if (target === "terms") {
        nextUrl = `${window.location.pathname}?terms=${nextTermsSection}`;
      } else {
        nextUrl = window.location.href;
      }
      window.history.pushState(
        target === "terms"
          ? { page: "terms", termsSection: nextTermsSection }
          : { page: target },
        "",
        nextUrl
      );
    }
    setPage(target);
    setSelectedContest(null);
    if (target === "terms") {
      setTermsSection(nextTermsSection);
    }
    if (target === "home") {
      document.title = "AdsDuck - 공모전 홍보 플랫폼";
      const savedY = Number(sessionStorage.getItem("ph-scroll-y") || 0);
      if (savedY > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedY, behavior: "instant" });
          });
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      if (target === "terms") {
        document.title = "이용약관 — AdsDuck";
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectTermsSection = (key) => {
    const next = TERMS_KEYS.has(key) ? key : DEFAULT_TERMS_KEY;
    if (next === termsSection) return;
    setTermsSection(next);
    const nextUrl = `${window.location.pathname}?terms=${next}`;
    window.history.pushState({ page: "terms", termsSection: next }, "", nextUrl);
  };

  const handleScrollToContests = () => {
    if (page !== "home") {
      setPage("home");
      setSelectedContest(null);
      window.history.pushState({ page: "home" }, "");
      setTimeout(() => {
        document.getElementById("contests")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } else {
      document.getElementById("contests")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex flex-col transition-colors duration-300">
      <Header
        onNavigate={handleNavigate}
        currentPage={page}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
      />

      <main className="flex-1">
        {page === "home" && (
          <>
            <Hero contests={contests} onScrollToContests={handleScrollToContests} />
            <ContestList
              contests={contests}
              onSelect={handleSelect}
              bookmarks={bookmarks}
              onToggleBookmark={toggleBookmark}
              onToast={addToast}
            />
          </>
        )}
        {page === "detail" && selectedContest && (
          <ContestDetail
            contest={selectedContest}
            contests={contests}
            onBack={() => handleNavigate("home")}
            onSelect={handleSelect}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            onToast={addToast}
          />
        )}
        {page === "terms" && (
          <Terms
            section={termsSection}
            onSelectSection={handleSelectTermsSection}
            onBack={() => handleNavigate("home")}
          />
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        onScrollToContests={handleScrollToContests}
        darkMode={darkMode}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ScrollToTop />
    </div>
  );
}

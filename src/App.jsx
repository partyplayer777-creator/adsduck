import { useState, useEffect } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ContestList from "./components/ContestList";
import ContestDetail from "./components/ContestDetail";
import Board from "./components/Board";
import Messages from "./components/Messages";
import PointCharge from "./components/PointCharge";
import LectureLetter from "./components/LectureLetter";
import OrganizerHost from "./components/OrganizerHost";
import Terms from "./components/Terms";
import Footer from "./components/Footer";
import { ToastContainer } from "./components/Toast";
import ScrollToTop from "./components/ScrollToTop";
import AuthDialog from "./components/AuthDialog";
import { contests } from "./data/contests";
import { allTerms } from "./data/terms";
import { useAuthSession } from "./hooks/useAuthSession";
import { usePointWallet } from "./hooks/usePointWallet";
import { useToast } from "./hooks/useToast";
import { getStoredItem, setStoredItem, STORAGE_KEYS, LEGACY_STORAGE_KEYS } from "./storageKeys";

const TERMS_KEYS = new Set(allTerms.map((t) => t.key));
const DEFAULT_TERMS_KEY = "service";

function getInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("board") === "1") {
    return {
      page: "board",
      contest: null,
      termsSection: DEFAULT_TERMS_KEY,
      title: "게시판 — AdsDuck",
      historyState: { page: "board" },
    };
  }

  if (params.get("lectures") === "1") {
    return {
      page: "lectures",
      contest: null,
      termsSection: DEFAULT_TERMS_KEY,
      title: "AI강의레터 — AdsDuck",
      historyState: { page: "lectures" },
    };
  }

  if (params.get("organizer") === "1") {
    return {
      page: "organizer",
      contest: null,
      termsSection: DEFAULT_TERMS_KEY,
      title: "공모전 주최하기 — AdsDuck",
      historyState: { page: "organizer" },
    };
  }

  if (params.get("messages") === "1") {
    return {
      page: "messages",
      contest: null,
      termsSection: DEFAULT_TERMS_KEY,
      title: "쪽지함 — AdsDuck",
      historyState: { page: "messages" },
    };
  }

  if (params.get("points") === "1") {
    return {
      page: "points",
      contest: null,
      termsSection: DEFAULT_TERMS_KEY,
      title: "포인트 충전 — AdsDuck",
      historyState: { page: "points" },
    };
  }

  const termsParam = params.get("terms");
  if (termsParam !== null) {
    const key = TERMS_KEYS.has(termsParam) ? termsParam : DEFAULT_TERMS_KEY;
    return {
      page: "terms",
      contest: null,
      termsSection: key,
      title: "이용약관 — AdsDuck",
      historyState: { page: "terms", termsSection: key },
    };
  }

  const contestId = Number(params.get("c"));
  if (contestId) {
    const contest = contests.find((c) => c.id === contestId);
    if (contest) {
      return {
        page: "detail",
        contest,
        termsSection: DEFAULT_TERMS_KEY,
        title: `${contest.title} — AdsDuck`,
        historyState: { page: "detail", contestId: contest.id },
      };
    }
  }

  return {
    page: "home",
    contest: null,
    termsSection: DEFAULT_TERMS_KEY,
    title: "AdsDuck - 공모전 홍보 플랫폼",
    historyState: { page: "home" },
  };
}

export default function App() {
  const [initialRoute] = useState(getInitialRoute);
  const [page, setPage] = useState(initialRoute.page);
  const [selectedContest, setSelectedContest] = useState(initialRoute.contest);
  const [termsSection, setTermsSection] = useState(initialRoute.termsSection);
  const { toasts, addToast, removeToast } = useToast();
  const authSession = useAuthSession();
  const pointAccount = usePointWallet(authSession.session);
  const [authDialogMode, setAuthDialogMode] = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = getStoredItem(localStorage, STORAGE_KEYS.darkMode, LEGACY_STORAGE_KEYS.darkMode);
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = getStoredItem(localStorage, STORAGE_KEYS.bookmarks, LEGACY_STORAGE_KEYS.bookmarks);
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
    setStoredItem(localStorage, STORAGE_KEYS.darkMode, String(darkMode));
  }, [darkMode]);

  // 초기 history state 세팅 + URL 파라미터로 직접 공유 지원
  //  ?c=ID      → 콘테스트 상세
  //  ?terms=K   → 이용약관 (K: service | ad | contest)
  useEffect(() => {
    document.title = initialRoute.title;
    window.history.replaceState(initialRoute.historyState, "");
  }, [initialRoute]);

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
      } else if (state.page === "board") {
        setPage("board");
        setSelectedContest(null);
      } else if (state.page === "lectures") {
        setPage("lectures");
        setSelectedContest(null);
      } else if (state.page === "organizer") {
        setPage("organizer");
        setSelectedContest(null);
      } else if (state.page === "messages") {
        setPage("messages");
        setSelectedContest(null);
      } else if (state.page === "points") {
        setPage("points");
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
      setStoredItem(localStorage, STORAGE_KEYS.bookmarks, JSON.stringify(next));
      return next;
    });
  };

  const handleSelect = (contest) => {
    setStoredItem(sessionStorage, STORAGE_KEYS.scrollY, String(window.scrollY));
    setSelectedContest(contest);
    setPage("detail");
    document.title = `${contest.title} — AdsDuck`;
    const url = `${window.location.pathname}?c=${contest.id}`;
    window.history.pushState({ page: "detail", contestId: contest.id }, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNavigate = (target, options = {}) => {
    if ((target === "messages" || target === "points") && !authSession.isAuthenticated) {
      setAuthDialogMode("login");
      return;
    }

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
      } else if (target === "board") {
        nextUrl = `${window.location.pathname}?board=1`;
      } else if (target === "lectures") {
        nextUrl = `${window.location.pathname}?lectures=1`;
      } else if (target === "organizer") {
        nextUrl = `${window.location.pathname}?organizer=1`;
      } else if (target === "messages") {
        nextUrl = `${window.location.pathname}?messages=1`;
      } else if (target === "points") {
        nextUrl = `${window.location.pathname}?points=1`;
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
      const savedY = Number(getStoredItem(sessionStorage, STORAGE_KEYS.scrollY, LEGACY_STORAGE_KEYS.scrollY) || 0);
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
      } else if (target === "board") {
        document.title = "게시판 — AdsDuck";
      } else if (target === "lectures") {
        document.title = "AI강의레터 — AdsDuck";
      } else if (target === "organizer") {
        document.title = "공모전 주최하기 — AdsDuck";
      } else if (target === "messages") {
        document.title = "쪽지함 — AdsDuck";
      } else if (target === "points") {
        document.title = "포인트 충전 — AdsDuck";
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
        authSession={authSession}
        onOpenAuth={setAuthDialogMode}
      />

      <main className="flex-1">
        {page === "home" && (
          <>
            <Hero
              contests={contests}
              onScrollToContests={handleScrollToContests}
              onNavigateOrganizer={() => handleNavigate("organizer")}
              darkMode={darkMode}
            />
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
            authSession={authSession.session}
            pointAccount={pointAccount}
            onRequireLogin={setAuthDialogMode}
          />
        )}
        {page === "board" && (
          <Board
            authSession={authSession.session}
            pointAccount={pointAccount}
            onRequireLogin={setAuthDialogMode}
            onToast={addToast}
            onOpenPoints={() => handleNavigate("points")}
          />
        )}
        {page === "lectures" && (
          <LectureLetter
            authSession={authSession.session}
            onRequireLogin={setAuthDialogMode}
            onToast={addToast}
            onOpenPoints={() => handleNavigate("points")}
          />
        )}
        {page === "messages" && (
          <Messages
            authSession={authSession.session}
            onRequireLogin={setAuthDialogMode}
          />
        )}
        {page === "points" && (
          <PointCharge
            authSession={authSession.session}
            pointAccount={pointAccount}
            onRequireLogin={setAuthDialogMode}
            onToast={addToast}
            onOpenTerms={() => handleNavigate("terms", { section: "points" })}
          />
        )}
        {page === "organizer" && (
          <OrganizerHost
            authSession={authSession.session}
            onToast={addToast}
            onBack={() => handleNavigate("home")}
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
      <AuthDialog
        open={!!authDialogMode}
        mode={authDialogMode || "login"}
        error={authSession.authError}
        enabledProviders={authSession.enabledProviders}
        onClose={() => setAuthDialogMode(null)}
        onProviderLogin={async (provider, mode, options) => {
          const started = await authSession.loginWithProvider(provider, mode, options);
          if (started !== false) {
            setAuthDialogMode(null);
          }
          return started;
        }}
        onEmailLogin={async (email, password, mode, options) => {
          const started = await authSession.loginWithEmail(email, password, mode, options);
          if (started !== false) {
            setAuthDialogMode(null);
          }
          return started;
        }}
      />
      <ScrollToTop />
    </div>
  );
}

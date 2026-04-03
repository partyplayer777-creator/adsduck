import { useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ContestList from "./components/ContestList";
import ContestDetail from "./components/ContestDetail";
import Footer from "./components/Footer";
import { contests } from "./data/contests";

export default function App() {
  const [page, setPage] = useState("home");
  const [selectedContest, setSelectedContest] = useState(null);

  const handleSelect = (contest) => {
    setSelectedContest(contest);
    setPage("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigate = (target) => {
    setPage(target);
    setSelectedContest(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex flex-col">
      <Header onNavigate={handleNavigate} currentPage={page} />

      <main className="flex-1">
        {page === "home" && (
          <>
            <Hero />
            <ContestList contests={contests} onSelect={handleSelect} />
          </>
        )}
        {page === "detail" && selectedContest && (
          <ContestDetail
            contest={selectedContest}
            onBack={() => handleNavigate("home")}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

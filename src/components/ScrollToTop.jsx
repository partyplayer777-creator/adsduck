import { useState, useEffect } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 450);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-28 sm:bottom-6 right-4 sm:right-6 z-50 w-10 h-10 sm:w-11 sm:h-11 bg-amber-400 dark:bg-amber-500 text-gray-900 rounded-2xl shadow-lg shadow-amber-400/40 flex items-center justify-center hover:bg-amber-300 dark:hover:bg-amber-400 hover:-translate-y-1 cursor-pointer transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-label="맨 위로 이동"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

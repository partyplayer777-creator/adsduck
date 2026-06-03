import { useState, useEffect } from "react";

function useCountUp(target, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export default function Hero({ contests, onScrollToContests, onNavigateOrganizer, darkMode }) {
  const now = new Date();
  const activeContests = contests.filter(
    (c) => new Date(c.deadline) > now
  );
  const totalParticipants = contests.reduce((sum, c) => sum + c.participants, 0);
  const totalPrize = contests.reduce((sum, c) => sum + c.prizeAmount, 0);
  const totalPrizeMan = Math.floor(totalPrize / 10000);

  const animatedActive = useCountUp(activeContests.length, 800);
  const animatedParticipants = useCountUp(totalParticipants, 1200);
  const animatedPrize = useCountUp(totalPrizeMan, 1400);
  const isDark = !!darkMode;

  const stats = [
    {
      label: "진행중 공모전",
      value: `${animatedActive}+`,
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
      accent: "text-amber-400",
    },
    {
      label: "누적 참여자",
      value: `${animatedParticipants.toLocaleString()}+`,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      accent: "text-amber-400",
    },
    {
      label: "누적 상금",
      value: `${animatedPrize.toLocaleString()}만원`,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      accent: "text-amber-400",
    },
  ];

  return (
    <section className={`relative overflow-hidden border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
      <div className={`absolute inset-0 ${
        isDark
          ? "bg-gray-950"
          : "bg-white"
      }`} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="max-w-2xl">
          <div className={`inline-flex items-center gap-2 rounded-md px-3 py-1 mb-4 animate-fade-in-up border ${
            isDark
              ? "bg-white/5 border-white/10"
              : "bg-gray-50 border-gray-200"
          }`}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className={`text-xs font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>
              현재 {activeContests.length}개 공모전 진행중
            </span>
          </div>

          <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-3 animate-fade-in-up delay-100 leading-tight [word-break:keep-all] ${isDark ? "text-white" : "text-gray-950"}`}>
            광고로 수익,{" "}
            <br className="sm:hidden" />
            <span className="relative inline-block">
              <span className="relative z-10 text-amber-500 dark:text-amber-300">
                AdsDuck
              </span>
            </span>
            이 연결합니다
          </h1>

          <p className={`text-sm sm:text-base mb-6 leading-6 animate-fade-in-up delay-200 max-w-xl ${isDark ? "text-white/60" : "text-gray-600"}`}>
            공모전 주최자와 크리에이터를 잇는 홍보 공모전 플랫폼.
            <br className="hidden sm:block" />
            크리에이터는 SNS 콘텐츠로 상금을 받고, 주최자는 효과적인 바이럴을 만드세요.
          </p>

          <div className="flex flex-col gap-2 animate-fade-in-up delay-300">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                onClick={onScrollToContests}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-400 bg-amber-400 px-4 py-2.5 text-sm font-bold text-gray-950 transition hover:bg-amber-300 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                크리에이터로 참여하기
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={onNavigateOrganizer}
                className={`group w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
                  isDark
                    ? "bg-white/5 text-white hover:bg-white/10 border border-white/15"
                    : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 2m6-2a9 9 0 1 1 -18 0 9 9 0 0 1 18 0Z" />
                </svg>
                공모전 주최하기
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-8 max-w-xl animate-fade-in-up delay-400">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-3 border ${
                isDark
                  ? "bg-white/[0.03] border-white/10"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="mb-2">
                <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <svg className={`w-4 h-4 ${stat.accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                  </svg>
                </div>
              </div>
              <p className={`text-base sm:text-lg font-black mb-0.5 leading-tight ${isDark ? "text-white" : "text-gray-950"}`} style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                {stat.value}
              </p>
              <p className={`text-[11px] font-semibold ${isDark ? "text-white/40" : "text-gray-500"}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

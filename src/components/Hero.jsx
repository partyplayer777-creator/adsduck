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

const COMPANY_CONTACT_URL = "https://open.kakao.com/o/sW7KjCxi";

export default function Hero({ contests, onScrollToContests }) {
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

  const handleCompanyContact = (e) => {
    e.preventDefault();
    window.open(COMPANY_CONTACT_URL, "_blank", "noopener,noreferrer");
  };

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
    <section className="relative overflow-hidden">
      {/* Background — 검정+금 브랜드 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950" />

      {/* Gold glow blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-yellow-500/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-float" />

      {/* Gold floating particles */}
      <div className="absolute top-[20%] left-[12%] w-2 h-2 bg-amber-400/40 rounded-full animate-float" style={{ animationDelay: "0s", animationDuration: "7s" }} />
      <div className="absolute top-[55%] left-[78%] w-1.5 h-1.5 bg-yellow-300/30 rounded-full animate-float" style={{ animationDelay: "2.5s", animationDuration: "9s" }} />
      <div className="absolute top-[35%] left-[88%] w-1 h-1 bg-amber-300/50 rounded-full animate-float" style={{ animationDelay: "1.2s", animationDuration: "6s" }} />
      <div className="absolute top-[70%] left-[22%] w-1.5 h-1.5 bg-yellow-400/35 rounded-full animate-float" style={{ animationDelay: "3.8s", animationDuration: "8s" }} />
      <div className="absolute top-[15%] left-[65%] w-1 h-1 bg-amber-500/40 rounded-full animate-float" style={{ animationDelay: "0.7s", animationDuration: "10s" }} />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 backdrop-blur-md rounded-full px-5 py-2 mb-8 animate-fade-in-up border border-amber-500/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
            </span>
            <span className="text-sm font-semibold text-amber-300">
              현재 {activeContests.length}개 공모전 진행중
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 animate-fade-in-up delay-100 leading-[1.15] [word-break:keep-all]">
            광고로 수익,{" "}
            <br className="sm:hidden" />
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                AdsDuck
              </span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-amber-400/15 rounded-full -z-0" />
            </span>
            이 연결합니다
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-white/60 mb-10 leading-relaxed animate-fade-in-up delay-200 max-w-2xl mx-auto">
            기업과 크리에이터를 잇는 공모전 홍보 플랫폼.
            <br className="hidden sm:block" />
            SNS 콘텐츠로 상금을 받고, 기업은 효과적인 바이럴을 만드세요.
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center justify-center gap-3 animate-fade-in-up delay-300">
            <button
              onClick={onScrollToContests}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold rounded-2xl hover:from-amber-300 hover:to-yellow-300 transition-all shadow-xl shadow-amber-500/25 hover:shadow-2xl hover:shadow-amber-500/35 hover:-translate-y-0.5 text-base border-none cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              크리에이터로 참여하기
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={handleCompanyContact}
              className="bg-transparent border-none text-xs font-bold cursor-pointer transition-colors text-white/35 hover:text-white/60"
            >
              기업 공모전 문의
            </button>
          </div>
        </div>

        {/* Stats — 더 크고 bold하게 */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-16 max-w-2xl mx-auto animate-fade-in-up delay-400">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center bg-white/[0.05] backdrop-blur-md rounded-2xl px-3 py-5 sm:px-6 sm:py-7 border border-amber-500/10 hover:bg-white/[0.08] hover:border-amber-500/20 transition-all"
            >
              <div className="flex justify-center mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <svg className={`w-5 h-5 sm:w-5 sm:h-5 ${stat.accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                  </svg>
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-black text-white mb-1 leading-tight" style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                {stat.value}
              </p>
              <p className="text-[11px] sm:text-xs text-white/40 font-semibold tracking-wide uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll down hint */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 animate-fade-in delay-500">
        <button
          onClick={onScrollToContests}
          aria-label="공모전 목록으로 스크롤"
          className="flex flex-col items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest">스크롤</span>
          <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
          <path d="M0 48h1440V24c-240 24-480 24-720 0S240 0 0 24v24z" className="fill-[#f8fafc] dark:fill-gray-950" />
        </svg>
      </div>
    </section>
  );
}

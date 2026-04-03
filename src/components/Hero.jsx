export default function Hero() {
  const stats = [
    { label: "진행중 공모전", value: "6+", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { label: "총 참여자", value: "1,890+", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "총 상금", value: "1,650만원", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 animate-gradient-x" />

      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-float" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-5 py-2 mb-8 animate-fade-in-up border border-white/10">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold text-white/90">
              현재 6개 공모전 진행중
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 animate-fade-in-up delay-100 leading-[1.15]">
            SNS 홍보로{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-300 bg-clip-text text-transparent">
                수익
              </span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-yellow-400/20 rounded-full -z-0" />
            </span>
            을 만드세요
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-white/70 mb-10 leading-relaxed animate-fade-in-up delay-200 max-w-2xl mx-auto">
            기업들이 올린 공모전에 참여하고, SNS 홍보 활동으로
            <br className="hidden sm:block" />
            상금을 받아가세요. 매일 새로운 기회가 열립니다.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            <a
              href="#contests"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-700 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/15 hover:-translate-y-0.5 text-base no-underline"
            >
              공모전 둘러보기
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-16 max-w-2xl mx-auto animate-fade-in-up delay-400">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center bg-white/[0.08] backdrop-blur-md rounded-2xl px-3 py-4 sm:px-6 sm:py-5 border border-white/10 hover:bg-white/[0.12] transition-colors"
            >
              <div className="flex justify-center mb-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-white mb-0.5 animate-count-up" style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                {stat.value}
              </p>
              <p className="text-[11px] sm:text-xs text-white/50 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
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

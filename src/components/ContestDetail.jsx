export default function ContestDetail({ contest, onBack }) {
  const daysLeft = Math.ceil(
    (new Date(contest.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  );
  const isUrgent = contest.status === "마감임박" || daysLeft <= 7;

  const infoCards = [
    {
      label: "상금",
      value: contest.prize,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "from-yellow-400 to-orange-500",
    },
    {
      label: "마감일",
      value: `${contest.deadline} (D-${daysLeft > 0 ? daysLeft : 0})`,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      color: isUrgent ? "from-red-400 to-red-500" : "from-primary-400 to-primary-600",
    },
    {
      label: "참여자",
      value: `${contest.participants.toLocaleString()}명`,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      color: "from-emerald-400 to-emerald-600",
    },
    {
      label: "카테고리",
      value: contest.category,
      icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
      color: "from-violet-400 to-violet-600",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-all bg-transparent border-none cursor-pointer text-sm font-semibold group hover:gap-3"
      >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        목록으로 돌아가기
      </button>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl shadow-gray-200/50 dark:shadow-none animate-fade-in-up">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 animate-gradient-x" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-400/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-6">
              <img
                src={contest.logo}
                alt={contest.company}
                className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-xl"
              />
              <div>
                <p className="text-white/70 text-sm font-semibold mb-1">
                  {contest.company}
                </p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                  {contest.title}
                </h1>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              {infoCards.map((card, i) => (
                <div
                  key={i}
                  className="bg-white/[0.08] backdrop-blur-md rounded-2xl px-4 py-4 border border-white/10 animate-fade-in-up"
                  style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                      </svg>
                    </div>
                    <p className="text-[11px] text-white/50 font-semibold uppercase tracking-wide">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-white leading-snug">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-10">
          {/* Description */}
          <div className="mb-10 animate-fade-in-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                공모전 설명
              </h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[15px] pl-10">
              {contest.description}
            </p>
          </div>

          {/* Requirements */}
          <div className="mb-10 animate-fade-in-up delay-300">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                참여 조건
              </h2>
            </div>
            <ul className="space-y-3 pl-10">
              {contest.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3 animate-slide-in-right" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                  <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-500 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                    {i + 1}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 text-[15px] leading-relaxed pt-0.5">
                    {req}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Download section */}
          <div className="bg-gradient-to-br from-primary-50 via-accent-50/50 to-primary-50 dark:from-primary-900/20 dark:via-accent-900/10 dark:to-primary-900/20 rounded-3xl p-6 sm:p-8 border border-primary-100 dark:border-primary-800/50 animate-fade-in-up delay-400">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-800/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    홍보 소재 다운로드
                  </h2>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed pl-10">
                  노션 링크에서 공모전에 필요한 이미지, 영상 등 홍보 소재를 다운로드할 수 있습니다.
                </p>
              </div>
              <a
                href={contest.notionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="notion-btn inline-flex items-center justify-center gap-3 px-7 py-4 text-white font-bold rounded-2xl shadow-lg no-underline flex-shrink-0"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.726l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM2.83 1.634l13.728-.933c1.682-.14 2.102.093 2.802.607l3.876 2.724c.466.326.606.746.606 1.26l-.047 15.036c0 .84-.326 1.494-1.494 1.587L7.075 22.848c-.886.046-1.306-.093-1.773-.7L2.35 18.13c-.513-.7-.746-1.213-.746-1.867V3.1c0-.84.326-1.4 1.168-1.493z" />
                </svg>
                노션에서 다운로드
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

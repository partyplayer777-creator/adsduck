export default function ContestCard({ contest, onClick, index = 0 }) {
  const daysLeft = Math.ceil(
    (new Date(contest.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  );

  const isUrgent = contest.status === "마감임박" || daysLeft <= 7;
  const progress = Math.max(0, Math.min(100, 100 - (daysLeft / 30) * 100));

  const categoryColors = {
    "SNS 마케팅": "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    "리뷰 콘텐츠": "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
    "인스타그램": "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
    "유튜브": "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    "틱톡": "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    "멀티 채널": "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <button
      onClick={() => onClick(contest)}
      className="group text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden cursor-pointer w-full card-hover animate-fade-in-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={contest.logo}
                alt={contest.company}
                className="w-11 h-11 rounded-xl shadow-sm"
              />
              {isUrgent && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse-soft" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {contest.company}
              </p>
              <span
                className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                  isUrgent
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}
              >
                {isUrgent ? "마감임박" : "진행중"}
              </span>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${categoryColors[contest.category] || "bg-gray-100 text-gray-600"}`}>
            {contest.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">
          {contest.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-5 leading-relaxed">
          {contest.description}
        </p>

        {/* Deadline progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">마감까지</span>
            <span className={`text-xs font-bold ${isUrgent ? "text-red-500" : "text-primary-600 dark:text-primary-400"}`}>
              D-{daysLeft > 0 ? daysLeft : 0}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isUrgent
                  ? "bg-gradient-to-r from-red-400 to-red-500"
                  : "bg-gradient-to-r from-primary-400 to-accent-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
              {contest.participants.toLocaleString()}명
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">최대</span>
            <span className="text-base font-extrabold text-primary-600 dark:text-primary-400">
              {(contest.prizeAmount / 10000).toLocaleString()}만원
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

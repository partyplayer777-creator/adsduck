import { useEffect, useMemo, useState } from "react";
import { getContestLeaderboard, watchContestLeaderboard } from "../api/adsduckApi";

function formatMetric(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${Math.floor(number / 1000)}K`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace(".0", "")}K`;
  return number.toLocaleString();
}

function platformLabel(platform) {
  const labels = {
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    blog: "Blog",
  };
  return labels[platform] || platform || "SNS";
}

export default function ParticipantLeaderboard({ contestId, authSession, refreshKey, onSubmitClick, onRequireLogin }) {
  const [leaderboard, setLeaderboard] = useState({ entries: [], participantCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getContestLeaderboard(contestId)
      .then((data) => {
        if (active) setLeaderboard(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = watchContestLeaderboard(contestId, (data) => {
      if (active) setLeaderboard(data);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [contestId, refreshKey]);

  const myEntry = useMemo(() => {
    const userId = authSession?.user?.id;
    if (!userId) return null;
    return leaderboard.entries?.find((entry) => entry.user_id === userId) || null;
  }, [authSession?.user?.id, leaderboard.entries]);

  const handleSubmitClick = () => {
    if (!authSession?.user) {
      onRequireLogin?.("login");
      return;
    }
    onSubmitClick?.();
  };

  return (
    <aside className="xl:sticky xl:top-[calc(var(--header-h,64px)+24px)] h-fit bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl shadow-gray-200/40 dark:shadow-none overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">실시간 랭킹</p>
            <h2 className="mt-1 text-lg font-extrabold text-gray-950 dark:text-white">
              참가자 {Number(leaderboard.participantCount || 0).toLocaleString()}명
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>

        {myEntry && (
          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 px-3 py-2">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              내 현재 순위 #{myEntry.rank}
            </p>
          </div>
        )}

        <button
          onClick={handleSubmitClick}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-none bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 font-extrabold cursor-pointer shadow-md shadow-amber-500/20"
        >
          공모전 참가 / 링크 첨부
        </button>
      </div>

      <div className="max-h-[620px] overflow-y-auto">
        {loading && (
          <div className="p-5 text-sm text-gray-400 dark:text-gray-500">랭킹을 불러오는 중</div>
        )}

        {!loading && leaderboard.entries?.length === 0 && (
          <div className="p-5 text-sm text-gray-400 dark:text-gray-500">
            아직 제출된 링크가 없습니다.
          </div>
        )}

        {leaderboard.entries?.map((entry) => (
          <div
            key={entry.id}
            className="p-4 border-b border-gray-50 dark:border-gray-800 last:border-b-0 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${
                entry.rank === 1
                  ? "bg-amber-400 text-gray-950"
                  : entry.rank === 2
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  : entry.rank === 3
                  ? "bg-orange-200 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              }`}>
                {entry.rank}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate">
                    {entry.display_name || entry.user_id}
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                    {platformLabel(entry.platform)}
                  </span>
                </div>
                <a
                  href={entry.sns_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline truncate"
                  title={entry.sns_url}
                >
                  {entry.title || entry.sns_url}
                </a>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/70 px-2 py-1.5">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">좋아요</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {formatMetric(entry.like_count)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/70 px-2 py-1.5">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">조회수</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {formatMetric(entry.view_count)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

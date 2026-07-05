import { useEffect, useState } from "react";
import { joinContest, submitContestEntry } from "../api/adsduckApi";
import { POINT_RULES } from "../hooks/usePointWallet";

const YOUTUBE_PLATFORM = { value: "youtube", label: "YouTube" };
const YOUTUBE_ONLY_CONTEST_IDS = new Set([9]);

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  YOUTUBE_PLATFORM,
  { value: "tiktok", label: "TikTok" },
  { value: "blog", label: "Blog" },
];

function isYouTubeOnlyContest(contest) {
  return YOUTUBE_ONLY_CONTEST_IDS.has(Number(contest?.id));
}

function isYouTubeUrl(snsUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(snsUrl);
  } catch {
    return false;
  }

  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
}

export default function EntrySubmitDialog({ open, contest, authSession, pointAccount, onClose, onSubmitted, onToast }) {
  const [platform, setPlatform] = useState("instagram");
  const [title, setTitle] = useState("");
  const [snsUrl, setSnsUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const youtubeOnly = isYouTubeOnlyContest(contest);
  const platformOptions = youtubeOnly ? [YOUTUBE_PLATFORM] : PLATFORMS;

  useEffect(() => {
    if (open && youtubeOnly) setPlatform(YOUTUBE_PLATFORM.value);
  }, [open, youtubeOnly]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (youtubeOnly && !isYouTubeUrl(snsUrl)) {
        throw new Error("불멍 공모전은 YouTube 링크만 제출할 수 있습니다.");
      }

      if ((pointAccount?.wallet?.balance || 0) < POINT_RULES.contestEntryCost) {
        throw new Error(`공모전 참가에는 ${POINT_RULES.contestEntryCost.toLocaleString()}포인트가 필요합니다.`);
      }
      await joinContest(contest.id, authSession);
      await submitContestEntry(
        contest.id,
        { platform: youtubeOnly ? YOUTUBE_PLATFORM.value : platform, title, snsUrl },
        authSession
      );
      const spendResult = pointAccount?.spendPoints(POINT_RULES.contestEntryCost, "공모전 참가");
      if (!spendResult?.ok) {
        throw new Error(spendResult?.error || "참가 포인트 결제에 실패했습니다.");
      }
      onToast?.(`참가 링크가 첨부됐어요. ${POINT_RULES.contestEntryCost.toLocaleString()}포인트가 사용됐습니다.`);
      onSubmitted?.();
      onClose();
      setTitle("");
      setSnsUrl("");
    } catch (submitError) {
      setError(submitError.message || "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <button
        className="absolute inset-0 bg-gray-950/60 border-none cursor-default"
        onClick={onClose}
        aria-label="참가 제출 창 닫기"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl p-5"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
              공모전 참가
            </p>
            <h2 className="text-lg font-extrabold text-gray-950 dark:text-white leading-snug">
              {contest.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              제작한 영상이나 게시물의 SNS 링크를 첨부하면 랭킹에 반영됩니다.
            </p>
            <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              참가 시 {POINT_RULES.contestEntryCost.toLocaleString()}포인트가 사용됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              업로드 채널
            </span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              disabled={youtubeOnly}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {platformOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              영상 제목
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 30초 브랜드 홍보 쇼츠"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              SNS 업로드 링크
            </span>
            <input
              value={snsUrl}
              onChange={(event) => setSnsUrl(event.target.value)}
              placeholder={youtubeOnly ? "https://www.youtube.com/watch?v=..." : "https://..."}
              required
              type="url"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm font-bold text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border-none bg-gradient-to-r from-amber-400 to-yellow-400 text-sm font-extrabold text-gray-950 cursor-pointer disabled:opacity-60"
          >
            {submitting ? "첨부 중" : "링크 첨부"}
          </button>
        </div>
      </form>
    </div>
  );
}

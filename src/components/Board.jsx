import { useMemo, useState } from "react";
import { POINT_RULES } from "../hooks/usePointWallet";
import { STORAGE_KEYS, getStoredItem, setStoredItem } from "../storageKeys";

const BOARD_TABS = [
  { key: "anonymous", label: "익명 게시판" },
  { key: "realname", label: "실명 게시판" },
];

const SEED_POSTS = [
  {
    id: "seed-anon-1",
    board: "anonymous",
    title: "조회수 기준이 높은 공모전은 초반 반응이 중요하네요",
    content: "업로드 첫날에 댓글과 공유가 몰리면 이후 노출도 달라지는 것 같습니다.",
    authorId: "seed-user-1",
    authorName: "익명회원",
    createdAt: "2026-05-30T09:00:00.000Z",
    likes: 14,
    likedBy: [],
    penaltyPoints: 0,
    targetBalancePreview: 1800,
    comments: [
      {
        id: "seed-comment-1",
        authorName: "익명회원",
        content: "맞아요. 초반 1시간 지표가 꽤 크게 보입니다.",
        createdAt: "2026-05-30T10:20:00.000Z",
      },
    ],
  },
  {
    id: "seed-real-1",
    board: "realname",
    title: "기업 공모전 참고자료는 어떤 형식이 가장 편한가요?",
    content: "로고, 제품 컷, 금지 표현, 필수 해시태그가 한 번에 정리된 문서가 있으면 제작 시간이 줄었습니다.",
    authorId: "seed-user-2",
    authorName: "min.creator",
    createdAt: "2026-05-29T14:00:00.000Z",
    likes: 9,
    likedBy: [],
    penaltyPoints: 0,
    targetBalancePreview: 2400,
    comments: [],
  },
];

function readPosts() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.boardPosts) || "null") || SEED_POSTS;
  } catch {
    return SEED_POSTS;
  }
}

function readPenaltyLedger() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.penaltyLedger) || "{}");
  } catch {
    return {};
  }
}

function writePenaltyLedger(ledger) {
  setStoredItem(localStorage, STORAGE_KEYS.penaltyLedger, JSON.stringify(ledger));
}

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function getHourlyPenaltyUsed(userId) {
  if (!userId) return 0;
  const ledger = readPenaltyLedger();
  const cutoff = Date.now() - 60 * 60 * 1000;
  return (ledger[userId] || [])
    .filter((item) => new Date(item.createdAt).getTime() > cutoff)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export default function Board({ authSession, pointAccount, onRequireLogin, onToast }) {
  const [activeBoard, setActiveBoard] = useState("anonymous");
  const [posts, setPosts] = useState(readPosts);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [comments, setComments] = useState({});
  const [penaltyAmounts, setPenaltyAmounts] = useState({});
  const [chargeAmount, setChargeAmount] = useState("10000");
  const [composerOpen, setComposerOpen] = useState(false);
  const user = authSession?.user || null;
  const userId = user?.id || null;
  const wallet = pointAccount?.wallet || null;
  const hourlyPenaltyUsed = getHourlyPenaltyUsed(userId);

  const visiblePosts = useMemo(
    () => posts.filter((post) => post.board === activeBoard),
    [activeBoard, posts]
  );

  const persistPosts = (updater) => {
    setPosts((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setStoredItem(localStorage, STORAGE_KEYS.boardPosts, JSON.stringify(next));
      return next;
    });
  };

  const requireActivity = () => {
    if (!userId) {
      onRequireLogin?.("login");
      return false;
    }
    if (pointAccount?.isActivityBlocked) {
      onToast?.("포인트가 마이너스라 게시판 활동이 제한됩니다.");
      return false;
    }
    return true;
  };

  const handlePointResult = (result, successMessage) => {
    if (!result?.ok) {
      onToast?.(result?.error || "포인트 처리에 실패했습니다.");
      return false;
    }
    onToast?.(successMessage);
    return true;
  };

  const handleCreatePost = (event) => {
    event.preventDefault();
    if (!requireActivity()) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      onToast?.("제목과 내용을 입력해주세요.");
      return;
    }

    const post = {
      id: `post-${Date.now()}`,
      board: activeBoard,
      title: draft.title.trim(),
      content: draft.content.trim(),
      authorId: userId,
      authorName: activeBoard === "anonymous"
        ? "익명회원"
        : user.display_name || user.email || "사용자",
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      penaltyPoints: 0,
      targetBalancePreview: wallet?.balance || 0,
      comments: [],
    };

    persistPosts((prev) => [post, ...prev]);
    setDraft({ title: "", content: "" });
    setComposerOpen(false);
    pointAccount?.addPoints(POINT_RULES.postReward, "게시글 작성 보상");
    onToast?.(`게시글 작성 보상 ${formatPoint(POINT_RULES.postReward)} 지급`);
  };

  const handleOpenComposer = () => {
    if (!userId) {
      onRequireLogin?.("login");
      return;
    }
    if (pointAccount?.isActivityBlocked) {
      onToast?.("포인트가 마이너스라 게시판 활동이 제한됩니다.");
      return;
    }
    setComposerOpen((value) => !value);
  };

  const handleLike = (postId) => {
    if (!requireActivity()) return;
    const post = posts.find((item) => item.id === postId);
    if (!post || post.likedBy?.includes(userId)) return;
    if (post.authorId === userId) {
      onToast?.("내 게시글에는 좋아요 보상을 받을 수 없습니다.");
      return;
    }

    persistPosts((prev) => prev.map((item) => (
      item.id === postId
        ? { ...item, likes: item.likes + 1, likedBy: [...(item.likedBy || []), userId] }
        : item
    )));
    pointAccount?.addPoints(POINT_RULES.likeReward, "게시글 좋아요 보상");
    onToast?.(`좋아요 보상 ${formatPoint(POINT_RULES.likeReward)} 지급`);
  };

  const handleComment = (postId) => {
    if (!requireActivity()) return;
    const content = (comments[postId] || "").trim();
    if (!content) return;

    persistPosts((prev) => prev.map((post) => (
      post.id === postId
        ? {
            ...post,
            comments: [
              ...(post.comments || []),
              {
                id: `comment-${Date.now()}`,
                authorName: post.board === "anonymous"
                  ? "익명회원"
                  : user.display_name || user.email || "사용자",
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : post
    )));
    setComments((prev) => ({ ...prev, [postId]: "" }));
    pointAccount?.addPoints(POINT_RULES.commentReward, "댓글 작성 보상");
    onToast?.(`댓글 보상 ${formatPoint(POINT_RULES.commentReward)} 지급`);
  };

  const handlePenalty = (postId) => {
    if (!requireActivity()) return;
    if (activeBoard !== "anonymous") {
      onToast?.("벌점 전투는 익명 게시판에서만 가능합니다.");
      return;
    }

    const post = posts.find((item) => item.id === postId);
    const amount = Math.max(0, Number(penaltyAmounts[postId]) || 0);
    if (!post || amount <= 0) {
      onToast?.("벌점으로 투자할 포인트를 입력해주세요.");
      return;
    }
    if (post.authorId === userId) {
      onToast?.("내 게시글에는 벌점을 줄 수 없습니다.");
      return;
    }
    if (hourlyPenaltyUsed + amount > POINT_RULES.penaltyHourlyLimit) {
      onToast?.(`벌점 전투는 1시간당 ${formatPoint(POINT_RULES.penaltyHourlyLimit)}까지 가능합니다.`);
      return;
    }

    const spendResult = pointAccount?.spendPoints(amount, "익명 게시판 벌점 전투");
    if (!spendResult?.ok) {
      onToast?.(spendResult?.error || "포인트가 부족합니다.");
      return;
    }
    const targetResult = pointAccount?.penalizeUser?.(
      post.authorId,
      amount,
      post.targetBalancePreview
    );
    if (!targetResult?.ok) {
      onToast?.(targetResult?.error || "상대 벌점 적용에 실패했습니다.");
      return;
    }

    persistPosts((prev) => prev.map((item) => (
      item.id === postId
        ? {
            ...item,
            penaltyPoints: (item.penaltyPoints || 0) + amount,
            targetBalancePreview: Number(item.targetBalancePreview || 0) - amount,
          }
        : item
    )));
    const ledger = readPenaltyLedger();
    ledger[userId] = [
      ...(ledger[userId] || []).filter((item) => new Date(item.createdAt).getTime() > Date.now() - 60 * 60 * 1000),
      { amount, createdAt: new Date().toISOString() },
    ];
    writePenaltyLedger(ledger);
    setPenaltyAmounts((prev) => ({ ...prev, [postId]: "" }));
    onToast?.(`상대에게 벌점 ${formatPoint(amount)} 적용`);
  };

  const handleCharge = () => {
    if (!userId) {
      onRequireLogin?.("login");
      return;
    }
    const result = pointAccount?.chargePoints(Number(chargeAmount));
    handlePointResult(result, `포인트 ${Number(chargeAmount || 0).toLocaleString()}P 충전`);
  };

  const handleAttendance = () => {
    if (!userId) {
      onRequireLogin?.("login");
      return;
    }
    const result = pointAccount?.checkAttendance();
    const prefix = result?.reset ? "하루 이상 쉬어서 1일차로 초기화됐습니다. " : "";
    handlePointResult(
      result,
      result?.ok ? `${prefix}연속 출석 ${result.day}일차 보너스 ${formatPoint(result.bonus)} 지급` : ""
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-amber-500 mb-2">커뮤니티</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-950 dark:text-white tracking-tight">
            게시판
          </h1>
        </div>
        <button
          onClick={handleOpenComposer}
          className="inline-flex items-center justify-center rounded-2xl border-none bg-gradient-to-r from-amber-400 to-yellow-400 px-5 py-3 text-sm font-extrabold text-gray-950 cursor-pointer shadow-lg shadow-amber-500/15"
        >
          글쓰기 +{formatPoint(POINT_RULES.postReward)}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="min-w-0 space-y-4">
          <div className="sticky top-[var(--header-h,64px)] z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-[#f8fafc]/95 dark:bg-gray-950/95 backdrop-blur-md">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {BOARD_TABS.map((tab) => {
                const count = posts.filter((post) => post.board === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveBoard(tab.key)}
                    className={`flex-shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold cursor-pointer transition-colors ${
                      activeBoard === tab.key
                        ? "border-amber-400 bg-amber-400 text-gray-950"
                        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-2 text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {!userId && (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-900/20 p-4 sm:p-5">
              <p className="text-base font-extrabold text-gray-950 dark:text-white">
                로그인하면 첫 가입 5,000P와 출석 보너스를 받을 수 있어요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onRequireLogin?.("login")}
                  className="rounded-xl border-none bg-gray-950 dark:bg-white px-4 py-2.5 text-sm font-extrabold text-white dark:text-gray-950 cursor-pointer"
                >
                  로그인
                </button>
                <button
                  onClick={() => onRequireLogin?.("signup")}
                  className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-gray-950/30 px-4 py-2.5 text-sm font-extrabold text-amber-700 dark:text-amber-300 cursor-pointer"
                >
                  회원가입
                </button>
              </div>
            </div>
          )}

          {composerOpen && (
            <form
              onSubmit={handleCreatePost}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-gray-950 dark:text-white">
                  {activeBoard === "anonymous" ? "익명으로 글쓰기" : "실명으로 글쓰기"}
                </h2>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-xl border-none bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 cursor-pointer"
                >
                  닫기
                </button>
              </div>
              <label className="block mb-3">
                <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="제목을 입력하세요"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">내용</span>
                <textarea
                  value={draft.content}
                  onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                  rows={4}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="공모전 후기, 질문, 제작 팁을 남겨보세요."
                />
              </label>
              <button
                type="submit"
                className="mt-4 w-full px-4 py-3 rounded-xl border-none bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-950 text-sm font-extrabold cursor-pointer disabled:opacity-60"
                disabled={pointAccount?.isActivityBlocked}
              >
                등록하기
              </button>
            </form>
          )}

          {visiblePosts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500">아직 글이 없습니다.</p>
              <button
                onClick={handleOpenComposer}
                className="mt-4 rounded-xl border-none bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-gray-950 cursor-pointer"
              >
                첫 글 쓰기
              </button>
            </div>
          )}

          {visiblePosts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400">
                      {post.authorName}
                    </span>
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">
                      {formatDate(post.createdAt)}
                    </span>
                    {post.board === "anonymous" && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-500">
                        벌점 전투 가능
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-gray-950 dark:text-white leading-snug">
                    {post.title}
                  </h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500">좋아요</p>
                  <p className="text-xl font-black text-gray-950 dark:text-white">{post.likes}</p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {post.content}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleLike(post.id)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm font-bold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  좋아요
                  <span className="ml-1 text-amber-500">+{formatPoint(POINT_RULES.likeReward)}</span>
                </button>
                {post.board === "anonymous" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={penaltyAmounts[post.id] || ""}
                      onChange={(event) => setPenaltyAmounts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                      type="number"
                      min="1"
                      max={POINT_RULES.penaltyHourlyLimit}
                      placeholder="벌점"
                      className="w-20 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-400"
                      aria-label="벌점 포인트"
                    />
                    <button
                      onClick={() => handlePenalty(post.id)}
                      className="px-3 py-2 rounded-xl border-none bg-red-500 text-white text-sm font-extrabold cursor-pointer"
                    >
                      적용
                    </button>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      사용 {formatPoint(hourlyPenaltyUsed)} / {formatPoint(POINT_RULES.penaltyHourlyLimit)}
                    </span>
                  </div>
                )}
              </div>

              {post.board === "anonymous" && (
                <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  누적 벌점 {formatPoint(post.penaltyPoints)} · 상대 포인트 예상 {formatPoint(post.targetBalancePreview)}
                </div>
              )}

              <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-4">
                <div className="space-y-2">
                  {(post.comments || []).slice(-3).map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                        {comment.authorName} · {formatDate(comment.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{comment.content}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={comments[post.id] || ""}
                    onChange={(event) => setComments((prev) => ({ ...prev, [post.id]: event.target.value }))}
                    className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="댓글 작성"
                  />
                  <button
                    onClick={() => handleComment(post.id)}
                    className="px-3 py-2.5 rounded-xl border-none bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-sm font-extrabold cursor-pointer"
                  >
                    +{formatPoint(POINT_RULES.commentReward)}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h,64px)+16px)] space-y-4">
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">내 포인트</p>
            <p className={`text-3xl font-black ${wallet?.balance < 0 ? "text-red-500" : "text-gray-950 dark:text-white"}`}>
              {wallet ? formatPoint(wallet.balance) : "-"}
            </p>
            {wallet?.balance < 0 && (
              <p className="mt-2 text-xs font-semibold text-red-500">
                포인트가 마이너스라 활동이 제한됩니다.
              </p>
            )}
            {userId ? (
              <>
                <button
                  onClick={handleAttendance}
                  className="mt-4 w-full rounded-xl border-none bg-amber-400 px-3 py-3 text-sm font-extrabold text-gray-950 cursor-pointer"
                >
                  출석하기
                </button>
                <p className="mt-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                  연속 출석 {wallet?.attendanceDay || 0}일
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={chargeAmount}
                    onChange={(event) => setChargeAmount(event.target.value)}
                    type="number"
                    min="1000"
                    step="1000"
                    className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    aria-label="충전 포인트"
                  />
                  <button
                    onClick={handleCharge}
                    className="px-3 py-2 rounded-xl border-none bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-sm font-extrabold cursor-pointer"
                  >
                    충전
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => onRequireLogin?.("login")}
                className="mt-4 w-full rounded-xl border-none bg-gray-950 dark:bg-white px-3 py-3 text-sm font-extrabold text-white dark:text-gray-950 cursor-pointer"
              >
                로그인하고 시작
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-sm font-extrabold text-gray-950 dark:text-white mb-3">포인트</p>
            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <p>글 작성 <b className="text-gray-900 dark:text-white">+{formatPoint(POINT_RULES.postReward)}</b></p>
              <p>댓글 <b className="text-gray-900 dark:text-white">+{formatPoint(POINT_RULES.commentReward)}</b></p>
              <p>좋아요 <b className="text-gray-900 dark:text-white">+{formatPoint(POINT_RULES.likeReward)}</b></p>
              <p>공모전 참가 <b className="text-gray-900 dark:text-white">-{formatPoint(POINT_RULES.contestEntryCost)}</b></p>
              <p>익명 벌점 <b className="text-gray-900 dark:text-white">1시간 {formatPoint(POINT_RULES.penaltyHourlyLimit)}</b></p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

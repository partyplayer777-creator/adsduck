import { useMemo, useState } from "react";
import { POINT_RULES } from "../hooks/usePointWallet";
import { STORAGE_KEYS, getStoredItem, setStoredItem } from "../storageKeys";

const BOARD_TABS = [
  {
    key: "anonymous",
    label: "익명",
    title: "익명 게시판",
    description: "아이디어, 질문, 피드백을 부담 없이 나누는 공간",
  },
  {
    key: "realname",
    label: "실명",
    title: "실명 게시판",
    description: "크리에이터 이름으로 신뢰 있게 소통하는 공간",
  },
];

const SEED_POSTS = [
  {
    id: "seed-anon-1",
    board: "anonymous",
    title: "조회수 기준보다 초반 반응이 더 중요하다는 말 맞나요?",
    content: "업로드 첫날에 댓글과 공유가 몰리면 이후 노출도 달라지는 것 같아서 경험담을 듣고 싶습니다.",
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
        content: "맞아요. 초반 1시간 지표가 꽤 크게 보이는 편입니다.",
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

const SORT_OPTIONS = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
];

const REWARD_ITEMS = [
  { label: "글쓰기", value: `+${POINT_RULES.postReward}P` },
  { label: "댓글", value: `+${POINT_RULES.commentReward}P` },
  { label: "좋아요", value: `+${POINT_RULES.likeReward}P` },
  { label: "공모전 참가", value: `-${POINT_RULES.contestEntryCost}P` },
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
  const [sortMode, setSortMode] = useState("latest");
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
  const activeMeta = BOARD_TABS.find((tab) => tab.key === activeBoard) || BOARD_TABS[0];

  const boardCounts = useMemo(() => (
    BOARD_TABS.reduce((counts, tab) => ({
      ...counts,
      [tab.key]: posts.filter((post) => post.board === tab.key).length,
    }), {})
  ), [posts]);

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter((post) => post.board === activeBoard);
    return [...filtered].sort((a, b) => {
      if (sortMode === "popular") {
        return (b.likes + (b.comments?.length || 0)) - (a.likes + (a.comments?.length || 0));
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeBoard, posts, sortMode]);

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
      onToast?.("벌점으로 사용할 포인트를 입력해주세요.");
      return;
    }
    if (post.authorId === userId) {
      onToast?.("내 게시글에는 벌점을 줄 수 없습니다.");
      return;
    }
    if (hourlyPenaltyUsed + amount > POINT_RULES.penaltyHourlyLimit) {
      onToast?.(`벌점 전투는 1시간에 ${formatPoint(POINT_RULES.penaltyHourlyLimit)}까지 가능합니다.`);
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
    <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">AdsDuck Community</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
            게시판
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
            크리에이터들이 공모전 경험과 제작 팁을 나누는 공간입니다.
          </p>
        </div>
        <button
          onClick={handleOpenComposer}
          className="flex h-12 items-center justify-center rounded-lg border-none bg-amber-400 px-5 text-sm font-black text-gray-950 shadow-sm shadow-amber-500/20 transition hover:bg-amber-300"
        >
          글쓰기 +{formatPoint(POINT_RULES.postReward)}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_312px] lg:items-start">
        <main className="min-w-0 space-y-4">
          <div className="sticky top-[var(--header-h,64px)] z-20 -mx-4 border-y border-gray-200 bg-[#f8fafc]/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 sm:mx-0 sm:rounded-lg sm:border">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2 overflow-x-auto">
                {BOARD_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveBoard(tab.key)}
                    className={`h-11 flex-shrink-0 rounded-lg border px-4 text-sm font-black transition ${
                      activeBoard === tab.key
                        ? "border-amber-400 bg-amber-400 text-gray-950"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-2 text-xs opacity-70">{boardCounts[tab.key] || 0}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-bold text-gray-500 dark:text-gray-400">
                  {activeMeta.description}
                </p>
                <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setSortMode(option.key)}
                      className={`h-9 rounded-md px-3 text-xs font-black ${
                        sortMode === option.key
                          ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!userId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/70 dark:bg-amber-900/20 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-black text-gray-950 dark:text-white">
                    로그인하면 첫 가입 5,000P와 출석 보너스를 받을 수 있어요.
                  </p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    글쓰기, 댓글, 좋아요 보상이 바로 지갑에 반영됩니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRequireLogin?.("login")}
                    className="h-11 rounded-lg border-none bg-gray-950 px-4 text-sm font-black text-white dark:bg-white dark:text-gray-950"
                  >
                    로그인
                  </button>
                  <button
                    onClick={() => onRequireLogin?.("signup")}
                    className="h-11 rounded-lg border border-amber-300 bg-white px-4 text-sm font-black text-amber-700 dark:border-amber-700 dark:bg-gray-950/30 dark:text-amber-300"
                  >
                    회원가입
                  </button>
                </div>
              </div>
            </div>
          )}

          {composerOpen && (
            <form
              onSubmit={handleCreatePost}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-amber-500">{activeMeta.title}</p>
                  <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">새 글 작성</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="h-10 rounded-lg border-none bg-gray-100 px-3 text-xs font-black text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                >
                  닫기
                </button>
              </div>
              <label className="mb-3 block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="제목을 입력하세요"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">내용</span>
                <textarea
                  value={draft.content}
                  onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm leading-6 text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="공모전 후기, 질문, 제작 팁을 남겨보세요."
                />
              </label>
              <button
                type="submit"
                className="mt-4 h-12 w-full rounded-lg border-none bg-amber-400 text-sm font-black text-gray-950 transition hover:bg-amber-300 disabled:opacity-60"
                disabled={pointAccount?.isActivityBlocked}
              >
                게시글 등록 +{formatPoint(POINT_RULES.postReward)}
              </button>
            </form>
          )}

          {visiblePosts.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400">아직 글이 없습니다.</p>
              <button
                onClick={handleOpenComposer}
                className="mt-4 h-11 rounded-lg border-none bg-amber-400 px-4 text-sm font-black text-gray-950"
              >
                첫 글 쓰기
              </button>
            </div>
          )}

          <div className="space-y-3">
            {visiblePosts.map((post) => (
              <article
                key={post.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 sm:p-5"
              >
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-black text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                    {post.board === "anonymous" ? "익" : "실"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-black text-gray-700 dark:text-gray-200">{post.authorName}</span>
                      <span className="text-gray-400 dark:text-gray-500">{formatDate(post.createdAt)}</span>
                      {post.board === "anonymous" && (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 font-bold text-red-500 dark:bg-red-900/20">
                          벌점 가능
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-lg font-black leading-snug text-gray-950 dark:text-white sm:text-xl">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {post.content}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    좋아요 {post.likes}
                    <span className="ml-1 text-amber-500">+{formatPoint(POINT_RULES.likeReward)}</span>
                  </button>
                  <div className="flex h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-black text-gray-600 dark:border-gray-800 dark:text-gray-300">
                    댓글 {(post.comments || []).length}
                  </div>
                  {post.board === "anonymous" && (
                    <details className="col-span-2 sm:min-w-[280px]">
                      <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-black text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
                        벌점 전투
                      </summary>
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/20">
                        <div className="flex gap-2">
                          <input
                            value={penaltyAmounts[post.id] || ""}
                            onChange={(event) => setPenaltyAmounts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                            type="number"
                            min="1"
                            max={POINT_RULES.penaltyHourlyLimit}
                            placeholder="포인트"
                            className="min-w-0 flex-1 rounded-lg border border-red-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-400 dark:border-red-900 dark:bg-gray-950 dark:text-gray-100"
                            aria-label="벌점 포인트"
                          />
                          <button
                            onClick={() => handlePenalty(post.id)}
                            className="h-11 rounded-lg border-none bg-red-500 px-4 text-sm font-black text-white"
                          >
                            적용
                          </button>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-red-500 dark:text-red-300">
                          1시간 사용 {formatPoint(hourlyPenaltyUsed)} / {formatPoint(POINT_RULES.penaltyHourlyLimit)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          누적 벌점 {formatPoint(post.penaltyPoints)} · 상대 예상 포인트 {formatPoint(post.targetBalancePreview)}
                        </p>
                      </div>
                    </details>
                  )}
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                  {(post.comments || []).length > 0 && (
                    <div className="mb-3 space-y-2">
                      {(post.comments || []).slice(-3).map((comment) => (
                        <div key={comment.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                          <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
                            {comment.authorName} · {formatDate(comment.createdAt)}
                          </p>
                          <p className="mt-1 text-sm leading-5 text-gray-700 dark:text-gray-300">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={comments[post.id] || ""}
                      onChange={(event) => setComments((prev) => ({ ...prev, [post.id]: event.target.value }))}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      placeholder="댓글 작성"
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      className="h-11 rounded-lg border-none bg-gray-950 px-3 text-sm font-black text-white dark:bg-white dark:text-gray-950 sm:px-4"
                    >
                      +{formatPoint(POINT_RULES.commentReward)}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--header-h,64px)+16px)]">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">내 포인트</p>
            <p className={`mt-2 text-3xl font-black ${wallet?.balance < 0 ? "text-red-500" : "text-gray-950 dark:text-white"}`}>
              {wallet ? formatPoint(wallet.balance) : "-"}
            </p>
            {wallet?.balance < 0 && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/30 dark:text-red-300">
                포인트가 마이너스라 게시판 활동이 제한됩니다.
              </p>
            )}
            {userId ? (
              <>
                <button
                  onClick={handleAttendance}
                  className="mt-4 h-12 w-full rounded-lg border-none bg-amber-400 text-sm font-black text-gray-950 hover:bg-amber-300"
                >
                  출석 보너스 받기
                </button>
                <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  연속 출석 {wallet?.attendanceDay || 0}일 · 10일차부터 1,000P 고정
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={chargeAmount}
                    onChange={(event) => setChargeAmount(event.target.value)}
                    type="number"
                    min="1000"
                    step="1000"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    aria-label="충전 포인트"
                  />
                  <button
                    onClick={handleCharge}
                    className="h-11 rounded-lg border-none bg-gray-950 px-4 text-sm font-black text-white dark:bg-white dark:text-gray-950"
                  >
                    충전
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => onRequireLogin?.("login")}
                className="mt-4 h-12 w-full rounded-lg border-none bg-gray-950 text-sm font-black text-white dark:bg-white dark:text-gray-950"
              >
                로그인하고 시작
              </button>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-black text-gray-950 dark:text-white">포인트 정책</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {REWARD_ITEMS.map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="mt-1 text-base font-black text-gray-950 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold leading-5 text-red-600 dark:bg-red-950/30 dark:text-red-300">
              익명 벌점은 내 포인트를 사용하며 1시간 최대 {formatPoint(POINT_RULES.penaltyHourlyLimit)}까지 가능합니다.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

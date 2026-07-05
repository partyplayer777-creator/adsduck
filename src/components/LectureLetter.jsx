import { useEffect, useMemo, useState } from "react";
import {
  createLectureAdminPost,
  createLectureReport,
  deleteLectureAdminPost,
  getLectureAuthorEarnings,
  getLectureAuthorSettlements,
  getLectureAdminSummary,
  getLecturePost,
  getLecturePosts,
  purchaseLectureMembership,
  refundLectureTransaction,
  readLecturePost,
  requestLectureAuthorSettlement,
  settleLectureAuthorRequest,
  subscribeLecturePost,
  updateLectureAccess,
  updateLectureAdminPost,
  updateLectureAuthorPermission,
  updateLectureReport,
} from "../api/adsduckApi";

const MEMBERSHIP_PLANS = [
  { key: "1m", label: "1개월", points: 50000 },
  { key: "3m", label: "3개월", points: 120000 },
  { key: "6m", label: "6개월", points: 200000 },
];

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error) {
  if (error?.data?.code === "insufficient_points") {
    return `포인트가 부족합니다. 필요 포인트: ${formatPoint(error.data.requiredPoints)}`;
  }
  if (error?.data?.code === "locked") {
    return "3회 열람을 모두 사용해 게시글이 잠겼습니다. 잠금 해제 구독으로 열람할 수 있습니다.";
  }
  return error?.message || "요청을 처리하지 못했습니다.";
}

function sanitizeBody(body) {
  return String(body || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isExpiringSoon(value) {
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  const remainingMs = expiresAt - Date.now();
  return remainingMs > 0 && remainingMs <= 7 * 24 * 60 * 60 * 1000;
}

function readLocalIdempotency(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeLocalIdempotency(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the server idempotency layer still protects submitted requests.
  }
}

function removeLocalIdempotency(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function makeStableActionKey(prefix, userId, targetId) {
  return `adsduck:${prefix}:${userId || "guest"}:${targetId || "unknown"}`;
}

function makeIdempotencyValue(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function LectureLetter({ authSession, onRequireLogin, onToast, onOpenPoints }) {
  const [posts, setPosts] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [membership, setMembership] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [adminPostDraft, setAdminPostDraft] = useState({
    id: "",
    title: "",
    summary: "",
    body: "",
    authorName: "AdsDuck AI",
    status: "draft",
    tags: "",
  });
  const [adminAccessDraft, setAdminAccessDraft] = useState({
    userId: "",
    postId: "",
  });
  const [adminAuthorDraft, setAdminAuthorDraft] = useState({
    userId: "",
    role: "writer",
    status: "active",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortMode, setSortMode] = useState("latest");
  const [pendingAction, setPendingAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const isAuthenticated = !!authSession?.user;
  const tags = useMemo(() => {
    const tagSet = new Set();
    posts.forEach((post) => (post.tags || []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [posts]);
  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts
      .filter((post) => {
        const matchesQuery = !query || [post.title, post.summary, post.authorName, ...(post.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(query);
        const matchesTag = selectedTag === "all" || (post.tags || []).includes(selectedTag);
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        if (sortMode === "price") return Number(a.readPrice || 0) - Number(b.readPrice || 0);
        if (sortMode === "reads") return Number(b.access?.readCount || 0) - Number(a.access?.readCount || 0);
        return new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime();
      });
  }, [posts, searchQuery, selectedTag, sortMode]);
  const selectedPost = useMemo(
    () => visiblePosts.find((post) => post.id === selectedPostId) || visiblePosts[0] || posts[0] || null,
    [posts, selectedPostId, visiblePosts]
  );

  const contentPost = activePost?.id === selectedPost?.id ? activePost : null;
  const bodyLines = sanitizeBody(contentPost?.body);
  const hasMembership = !!membership;
  const watermark = authSession?.user?.email || authSession?.user?.display_name || "AdsDuck";

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getLecturePosts(authSession);
      setPosts(data.posts || []);
      setWallet(data.wallet || null);
      setMembership(data.membership || null);
      setSelectedPostId((current) => current || data.posts?.[0]?.id || null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession?.accessToken]);

  useEffect(() => {
    if (!selectedPost?.id || !isAuthenticated) {
      setActivePost(null);
      return;
    }

    if (!selectedPost.hasActiveMembership && !selectedPost.access?.isSubscribed) {
      setActivePost(null);
      return;
    }

    let cancelled = false;
    getLecturePost(selectedPost.id, authSession)
      .then((data) => {
        if (!cancelled && data.post?.body) {
          setActivePost(data.post);
          setWallet(data.wallet || null);
          setMembership(data.membership || null);
        }
      })
      .catch(() => {
        if (!cancelled) setActivePost(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authSession, isAuthenticated, selectedPost?.access?.isSubscribed, selectedPost?.hasActiveMembership, selectedPost?.id]);

  useEffect(() => {
    if (!bodyLines.length) return undefined;

    const preventCopyKeys = (event) => {
      const key = event.key?.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["c", "x", "s", "p"].includes(key)) {
        event.preventDefault();
        onToast?.("유료 콘텐츠 복사와 저장은 제한됩니다.", "error");
      }
    };
    const warnScreenExit = () => {
      onToast?.("유료 콘텐츠 열람 중 화면 이탈이 감지되었습니다.", "error");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") warnScreenExit();
    };

    window.addEventListener("keydown", preventCopyKeys);
    window.addEventListener("blur", warnScreenExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", preventCopyKeys);
      window.removeEventListener("blur", warnScreenExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [bodyLines.length, onToast]);

  const applyActionResult = (data) => {
    if (data.wallet) setWallet(data.wallet);
    if (data.membership) setMembership(data.membership);
    if (data.post?.body) setActivePost(data.post);
    return loadPosts();
  };

  const requireLogin = () => {
    if (isAuthenticated) return false;
    onRequireLogin?.("login");
    return true;
  };

  const handleRead = async (idempotencyKey = "") => {
    if (requireLogin() || !selectedPost) return false;
    setActionLoading(`read-${selectedPost.id}`);
    setError("");
    try {
      const data = await readLecturePost(selectedPost.id, authSession, idempotencyKey);
      await applyActionResult(data);
      onToast?.(`${formatPoint(data.chargedPoints)}를 사용해 게시글을 열람했습니다.`);
      return true;
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onToast?.(message, "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleSubscribe = async (idempotencyKey = "") => {
    if (requireLogin() || !selectedPost) return false;
    setActionLoading(`subscribe-${selectedPost.id}`);
    setError("");
    try {
      const data = await subscribeLecturePost(selectedPost.id, authSession, idempotencyKey);
      await applyActionResult(data);
      onToast?.(`${formatPoint(data.chargedPoints)}를 사용해 게시글 구독권을 구매했습니다.`);
      return true;
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onToast?.(message, "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleMembership = async (planKey, idempotencyKey = "") => {
    if (requireLogin()) return false;
    setActionLoading(`membership-${planKey}`);
    setError("");
    try {
      const data = await purchaseLectureMembership(planKey, authSession, idempotencyKey);
      await applyActionResult(data);
      onToast?.(`${formatPoint(data.chargedPoints)}를 사용해 정기구독권을 구매했습니다.`);
      return true;
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onToast?.(message, "error");
    } finally {
      setActionLoading("");
    }
  };

  const openConfirm = (action) => {
    if (requireLogin()) return;
    const userKey = authSession?.user?.id || authSession?.user?.email || authSession?.email || "user";
    const targetId = action.type === "membership" ? action.planKey : selectedPost?.id;
    const prefix = action.type === "membership" ? "lecture-membership" : `lecture-${action.type}`;
    const storageKey = makeStableActionKey(prefix, userKey, targetId);
    const savedKey = readLocalIdempotency(storageKey);
    const idempotencyKey = savedKey || makeIdempotencyValue(prefix);
    if (!savedKey) writeLocalIdempotency(storageKey, idempotencyKey);
    setPendingAction({ ...action, idempotencyKey, storageKey });
  };

  const runPendingAction = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    let succeeded = false;
    if (action.type === "read") {
      succeeded = await handleRead(action.idempotencyKey);
    } else if (action.type === "subscribe") {
      succeeded = await handleSubscribe(action.idempotencyKey);
    } else if (action.type === "membership") {
      succeeded = await handleMembership(action.planKey, action.idempotencyKey);
    }
    if (succeeded && action.storageKey) {
      removeLocalIdempotency(action.storageKey);
    }
  };

  const handleLoadEarnings = async () => {
    if (requireLogin()) return;
    setActionLoading("earnings");
    try {
      const [earningsData, settlementData] = await Promise.all([
        getLectureAuthorEarnings(authSession),
        getLectureAuthorSettlements(authSession),
      ]);
      setEarnings(earningsData.summary || null);
      setSettlements(settlementData.settlements || []);
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleRequestSettlement = async () => {
    if (requireLogin()) return;
    setActionLoading("settlement-request");
    try {
      await requestLectureAuthorSettlement("AI강의레터 작가 정산 신청", authSession);
      await handleLoadEarnings();
      onToast?.("정산 신청이 접수되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleReport = async () => {
    if (requireLogin() || !selectedPost) return;
    if (!reportReason.trim()) {
      onToast?.("신고 사유를 입력해 주세요.", "error");
      return;
    }
    setActionLoading("report");
    try {
      await createLectureReport({
        postId: selectedPost.id,
        reason: reportReason,
        detail: reportDetail,
      }, authSession);
      setReportReason("");
      setReportDetail("");
      onToast?.("신고가 접수되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const loadAdminSummary = async () => {
    if (!adminSecret.trim()) {
      onToast?.("관리자 secret을 입력해 주세요.", "error");
      return;
    }
    setActionLoading("admin-summary");
    try {
      const data = await getLectureAdminSummary(adminSecret.trim());
      setAdminData(data);
      onToast?.("관리자 현황을 불러왔습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const saveAdminPost = async () => {
    if (!adminSecret.trim()) {
      onToast?.("관리자 secret을 입력해 주세요.", "error");
      return;
    }
    setActionLoading("admin-post");
    try {
      const payload = {
        ...adminPostDraft,
        body: adminPostDraft.id && !adminPostDraft.body.trim() ? undefined : adminPostDraft.body,
        tags: adminPostDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      };
      if (adminPostDraft.id) {
        await updateLectureAdminPost(adminPostDraft.id, payload, adminSecret.trim());
      } else {
        await createLectureAdminPost(payload, adminSecret.trim());
      }
      setAdminPostDraft({
        id: "",
        title: "",
        summary: "",
        body: "",
        authorName: "AdsDuck AI",
        status: "draft",
        tags: "",
      });
      await loadAdminSummary();
      await loadPosts();
      onToast?.("게시글이 저장되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminRefund = async (transactionId) => {
    if (!adminSecret.trim()) return;
    setActionLoading(`refund-${transactionId}`);
    try {
      await refundLectureTransaction({
        transactionId,
        reason: "관리자 환불",
        revokeAccess: true,
      }, adminSecret.trim());
      await loadAdminSummary();
      await loadPosts();
      onToast?.("환불과 권한 회수 처리가 완료되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminUnlockAccess = async () => {
    if (!adminSecret.trim()) return;
    if (!adminAccessDraft.userId.trim() || !adminAccessDraft.postId.trim()) {
      onToast?.("유저 ID와 게시글 ID를 입력해 주세요.", "error");
      return;
    }
    setActionLoading("admin-access");
    try {
      await updateLectureAccess({
        userId: adminAccessDraft.userId.trim(),
        postId: adminAccessDraft.postId.trim(),
        unlock: true,
      }, adminSecret.trim());
      await loadAdminSummary();
      onToast?.("게시글 잠금이 해제되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminGrantSubscription = async () => {
    if (!adminSecret.trim()) return;
    if (!adminAccessDraft.userId.trim() || !adminAccessDraft.postId.trim()) {
      onToast?.("유저 ID와 게시글 ID를 입력해 주세요.", "error");
      return;
    }
    setActionLoading("admin-access");
    try {
      await updateLectureAccess({
        userId: adminAccessDraft.userId.trim(),
        postId: adminAccessDraft.postId.trim(),
        unlock: true,
        isSubscribed: true,
      }, adminSecret.trim());
      await loadAdminSummary();
      onToast?.("게시글 구독권이 부여되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminSaveAuthor = async () => {
    if (!adminSecret.trim()) return;
    if (!adminAuthorDraft.userId.trim()) {
      onToast?.("작성자 유저 ID를 입력해 주세요.", "error");
      return;
    }
    setActionLoading("admin-author");
    try {
      await updateLectureAuthorPermission({
        userId: adminAuthorDraft.userId.trim(),
        role: adminAuthorDraft.role,
        status: adminAuthorDraft.status,
      }, adminSecret.trim());
      await loadAdminSummary();
      onToast?.("작성자 권한이 저장되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminDeletePost = async (postId) => {
    if (!adminSecret.trim()) return;
    setActionLoading(`delete-${postId}`);
    try {
      await deleteLectureAdminPost(postId, adminSecret.trim());
      await loadAdminSummary();
      await loadPosts();
      onToast?.("게시글이 삭제 상태로 변경되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminReportStatus = async (reportId, status) => {
    if (!adminSecret.trim()) return;
    setActionLoading(`report-${reportId}`);
    try {
      await updateLectureReport(reportId, { status }, adminSecret.trim());
      await loadAdminSummary();
      onToast?.("신고 상태가 변경되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleAdminSettle = async (requestId) => {
    if (!adminSecret.trim()) return;
    setActionLoading(`settle-${requestId}`);
    try {
      await settleLectureAuthorRequest(requestId, { adminNote: "관리자 정산 완료" }, adminSecret.trim());
      await loadAdminSummary();
      onToast?.("정산 요청이 완료 처리되었습니다.");
    } catch (requestError) {
      onToast?.(getErrorMessage(requestError), "error");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <section className="bg-[#f8fafc] py-6 dark:bg-gray-950 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">AI Lecture Letter</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-3xl">
              애즈덕 AI강의레터
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-gray-500 dark:text-gray-400">
              AI 교육 콘텐츠를 포인트로 읽거나 게시글별 구독권, 정기구독권으로 열람합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-black text-amber-600 dark:border-gray-800 dark:bg-gray-900 dark:text-amber-300">
              {wallet ? formatPoint(wallet.balance) : isAuthenticated ? "지갑 조회 중" : "로그인 필요"}
            </div>
            <button
              type="button"
              onClick={onOpenPoints}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              포인트 내역
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-gray-950 dark:text-white">정기구독권</p>
                {membership && (
                  <span className={`rounded px-2 py-1 text-xs font-black ${
                    isExpiringSoon(membership.expiresAt)
                      ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}>
                    {isExpiringSoon(membership.expiresAt) ? "만료 임박 · " : ""}
                    {formatDate(membership.expiresAt)}까지
                  </span>
                )}
              </div>
              <div className="grid gap-2">
                {MEMBERSHIP_PLANS.map((plan) => (
                  <button
                    key={plan.key}
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => openConfirm({
                      type: "membership",
                      planKey: plan.key,
                      title: `${plan.label} 정기구독권 구매`,
                      points: plan.points,
                      description: "구매하면 보유 중인 정기구독권 만료일 뒤로 기간이 연장됩니다.",
                    })}
                    className="flex h-12 items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 text-left transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-amber-500/60 dark:hover:bg-amber-950/30"
                  >
                    <span className="text-sm font-black text-gray-950 dark:text-white">{plan.label}</span>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-300">{formatPoint(plan.points)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-gray-950 dark:text-white">게시글</p>
                <button
                  type="button"
                  onClick={loadPosts}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                >
                  새로고침
                </button>
              </div>
              <div className="mb-3 grid gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="제목, 요약, 태그 검색"
                  className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedTag}
                    onChange={(event) => setSelectedTag(event.target.value)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  >
                    <option value="all">전체 태그</option>
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  >
                    <option value="latest">최신순</option>
                    <option value="price">낮은 읽기 가격순</option>
                    <option value="reads">내 열람 많은순</option>
                  </select>
                </div>
              </div>
              {loading ? (
                <p className="rounded-md bg-gray-50 p-3 text-sm font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  불러오는 중입니다.
                </p>
              ) : visiblePosts.length === 0 ? (
                <p className="rounded-md bg-gray-50 p-3 text-sm font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  조건에 맞는 강의레터가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {visiblePosts.map((post) => {
                    const selected = selectedPost?.id === post.id;
                    const locked = post.access?.isLocked && !post.access?.isSubscribed && !post.hasActiveMembership;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setSelectedPostId(post.id)}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          selected
                            ? "border-amber-300 bg-amber-50 dark:border-amber-500/70 dark:bg-amber-950/30"
                            : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-black leading-5 text-gray-950 dark:text-white">{post.title}</p>
                          {locked && <span className="shrink-0 text-xs font-black text-red-500">잠김</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">
                          {post.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                          <span>읽기 {formatPoint(post.readPrice)}</span>
                          <span>구독 {formatPoint(locked ? post.unlockPrice : post.subscribePrice)}</span>
                          <span>{post.access?.readCount || 0}/3회</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-950 dark:text-white">작가 수익</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">일반 결제 70% 적립 기준</p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadEarnings}
                  disabled={actionLoading === "earnings"}
                  className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  조회
                </button>
              </div>
              {earnings && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">총 적립</p>
                      <p className="mt-1 text-sm font-black text-gray-950 dark:text-white">{formatPoint(earnings.totalAuthorPoints)}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">대기</p>
                      <p className="mt-1 text-sm font-black text-gray-950 dark:text-white">{formatPoint(earnings.pending)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestSettlement}
                    disabled={!!actionLoading}
                    className="mt-3 h-9 w-full rounded-md border-none bg-gray-950 text-xs font-black text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-gray-950"
                  >
                    정산 신청
                  </button>
                  {settlements.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {settlements.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-md bg-gray-50 p-2 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {formatPoint(item.requested_points)} · {item.status}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-black text-gray-950 dark:text-white">복제/유출 신고</p>
              <input
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="신고 사유"
                className="mt-3 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
              <textarea
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                placeholder="상세 내용"
                rows={3}
                className="mt-2 w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={handleReport}
                disabled={!!actionLoading}
                className="mt-2 h-9 w-full rounded-md border border-red-200 bg-red-50 text-xs font-black text-red-600 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                신고 접수
              </button>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-950 dark:text-white">관리자</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">매출, 환불, 신고, 정산 관리</p>
                </div>
                <button
                  type="button"
                  onClick={loadAdminSummary}
                  disabled={actionLoading === "admin-summary"}
                  className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  조회
                </button>
              </div>
              <input
                value={adminSecret}
                onChange={(event) => setAdminSecret(event.target.value)}
                placeholder="관리자 secret"
                type="password"
                className="mt-3 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
              {adminData && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">결제</p>
                      <p className="text-sm font-black text-gray-950 dark:text-white">{formatPoint(adminData.summary?.transactionSpendPoints)}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">신고</p>
                      <p className="text-sm font-black text-gray-950 dark:text-white">{adminData.summary?.openReports || 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={adminPostDraft.title}
                      onChange={(event) => setAdminPostDraft((draft) => ({ ...draft, title: event.target.value }))}
                      placeholder="게시글 제목"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <input
                      value={adminPostDraft.summary}
                      onChange={(event) => setAdminPostDraft((draft) => ({ ...draft, summary: event.target.value }))}
                      placeholder="요약"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <textarea
                      value={adminPostDraft.body}
                      onChange={(event) => setAdminPostDraft((draft) => ({ ...draft, body: event.target.value }))}
                      placeholder="본문"
                      rows={4}
                      className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={adminPostDraft.status}
                        onChange={(event) => setAdminPostDraft((draft) => ({ ...draft, status: event.target.value }))}
                        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      >
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                        <option value="hidden">hidden</option>
                      </select>
                      <input
                        value={adminPostDraft.tags}
                        onChange={(event) => setAdminPostDraft((draft) => ({ ...draft, tags: event.target.value }))}
                        placeholder="태그, 쉼표 구분"
                        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveAdminPost}
                      disabled={!!actionLoading}
                      className="h-9 w-full rounded-md border-none bg-amber-400 text-xs font-black text-gray-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      게시글 저장
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(adminData.posts || []).slice(0, 4).map((post) => (
                      <div key={post.id} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-xs font-black text-gray-950 dark:text-white">{post.title}</p>
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{post.status}</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => setAdminPostDraft({
                              id: post.id,
                              title: post.title || "",
                              summary: post.summary || "",
                              body: "",
                              authorName: post.author_name || "AdsDuck AI",
                              status: post.status || "draft",
                              tags: "",
                            })}
                            className="h-7 rounded border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminDeletePost(post.id)}
                            className="h-7 rounded border border-red-200 bg-red-50 px-2 text-[11px] font-bold text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                    <p className="text-xs font-black text-gray-950 dark:text-white">권한 조정</p>
                    <input
                      value={adminAccessDraft.userId}
                      onChange={(event) => setAdminAccessDraft((draft) => ({ ...draft, userId: event.target.value }))}
                      placeholder="유저 ID"
                      className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <input
                      value={adminAccessDraft.postId}
                      onChange={(event) => setAdminAccessDraft((draft) => ({ ...draft, postId: event.target.value }))}
                      placeholder="게시글 ID"
                      className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleAdminUnlockAccess}
                        disabled={actionLoading === "admin-access"}
                        className="h-8 rounded border border-gray-200 bg-white text-[11px] font-bold text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      >
                        잠금 해제
                      </button>
                      <button
                        type="button"
                        onClick={handleAdminGrantSubscription}
                        disabled={actionLoading === "admin-access"}
                        className="h-8 rounded border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                      >
                        구독 부여
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                    <p className="text-xs font-black text-gray-950 dark:text-white">작성자 권한</p>
                    <input
                      value={adminAuthorDraft.userId}
                      onChange={(event) => setAdminAuthorDraft((draft) => ({ ...draft, userId: event.target.value }))}
                      placeholder="작성자 유저 ID"
                      className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={adminAuthorDraft.role}
                        onChange={(event) => setAdminAuthorDraft((draft) => ({ ...draft, role: event.target.value }))}
                        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      >
                        <option value="writer">writer</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                      <select
                        value={adminAuthorDraft.status}
                        onChange={(event) => setAdminAuthorDraft((draft) => ({ ...draft, status: event.target.value }))}
                        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      >
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdminSaveAuthor}
                      disabled={actionLoading === "admin-author"}
                      className="h-8 w-full rounded border border-gray-200 bg-white text-[11px] font-bold text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                    >
                      작성자 권한 저장
                    </button>
                    {(adminData.authors || []).slice(0, 3).map((author) => (
                      <div key={author.user_id} className="rounded bg-white p-2 text-[11px] font-bold text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                        {author.user_id} · {author.role} · {author.status}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(adminData.transactions || []).filter((item) => item.amount < 0).slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAdminRefund(item.id)}
                        className="w-full rounded-md border border-gray-200 bg-white p-2 text-left text-xs font-bold text-gray-600 hover:border-red-200 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      >
                        환불 {formatPoint(Math.abs(item.amount))} · {item.type}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(adminData.reports || []).slice(0, 3).map((report) => (
                      <div key={report.id} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                        <p className="text-xs font-black text-gray-950 dark:text-white">{report.reason}</p>
                        <button
                          type="button"
                          onClick={() => handleAdminReportStatus(report.id, "resolved")}
                          className="mt-2 h-7 rounded border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                        >
                          resolved
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(adminData.settlements || []).filter((item) => item.status !== "settled").slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAdminSettle(item.id)}
                        className="w-full rounded-md border border-gray-200 bg-white p-2 text-left text-xs font-bold text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      >
                        정산 완료 {formatPoint(item.requested_points)} · {item.status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <main className="min-h-[560px] rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {!selectedPost ? (
              <div className="flex min-h-[420px] items-center justify-center p-6 text-sm font-bold text-gray-500">
                선택할 강의레터가 없습니다.
              </div>
            ) : (
              <article className="flex min-h-[560px] flex-col">
                <div className="border-b border-gray-200 p-4 dark:border-gray-800 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-300">
                        {selectedPost.authorName} · {formatDate(selectedPost.publishedAt)}
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">
                        {selectedPost.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500 dark:text-gray-400">
                        {selectedPost.summary}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:w-64">
                      <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-950">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">읽기</p>
                        <p className="text-sm font-black text-gray-950 dark:text-white">{formatPoint(selectedPost.readPrice)}</p>
                      </div>
                      <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-950">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">구독</p>
                        <p className="text-sm font-black text-gray-950 dark:text-white">
                          {formatPoint(selectedPost.access?.isLocked ? selectedPost.unlockPrice : selectedPost.subscribePrice)}
                        </p>
                      </div>
                      <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-950">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">횟수</p>
                        <p className="text-sm font-black text-gray-950 dark:text-white">{selectedPost.access?.readCount || 0}/3</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasMembership || selectedPost.access?.isSubscribed ? (
                      <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        무료 열람 권한 보유
                      </span>
                    ) : selectedPost.access?.isLocked ? (
                      <span className="rounded-md bg-red-50 px-3 py-2 text-sm font-black text-red-600 dark:bg-red-950/30 dark:text-red-300">
                        3회 열람 완료로 잠김
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConfirm({
                          type: "read",
                          title: "1회 읽기",
                          points: selectedPost.readPrice,
                          description: "열람 성공 시 이 게시글의 읽기 횟수가 1회 증가합니다.",
                        })}
                        disabled={!!actionLoading}
                        className="h-10 rounded-md border-none bg-gray-950 px-4 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                      >
                        1회 읽기 {formatPoint(selectedPost.readPrice)}
                      </button>
                    )}

                    {!selectedPost.access?.isSubscribed && (
                      <button
                        type="button"
                        onClick={() => openConfirm({
                          type: "subscribe",
                          title: selectedPost.access?.isLocked ? "잠금 해제 구독" : "게시글 구독",
                          points: selectedPost.access?.isLocked ? selectedPost.unlockPrice : selectedPost.subscribePrice,
                          description: selectedPost.access?.isLocked
                            ? "잠긴 게시글은 현재 구독 포인트의 5배를 사용해 구독합니다."
                            : "구독 후 이 게시글은 추가 포인트 없이 계속 열람할 수 있습니다.",
                        })}
                        disabled={!!actionLoading}
                        className="h-10 rounded-md border-none bg-amber-400 px-4 text-sm font-black text-gray-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                      >
                        {selectedPost.access?.isLocked ? "잠금 해제 구독" : "게시글 구독"}{" "}
                        {formatPoint(selectedPost.access?.isLocked ? selectedPost.unlockPrice : selectedPost.subscribePrice)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative flex-1 p-4 sm:p-6">
                  {bodyLines.length > 0 ? (
                    <div
                      className="lecture-protected-content relative select-none overflow-hidden rounded-md border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950"
                      onCopy={(event) => event.preventDefault()}
                      onCut={(event) => event.preventDefault()}
                      onContextMenu={(event) => event.preventDefault()}
                      style={{ WebkitUserSelect: "none", userSelect: "none" }}
                    >
                      <div className="pointer-events-none absolute inset-0 grid rotate-[-18deg] grid-cols-2 gap-10 opacity-[0.055]">
                        {Array.from({ length: 12 }).map((_, index) => (
                          <span key={index} className="text-xl font-black text-gray-900 dark:text-white">
                            {watermark}
                          </span>
                        ))}
                      </div>
                      <div className="relative space-y-4 text-base font-semibold leading-8 text-gray-800 dark:text-gray-100">
                        {bodyLines.map((line, index) => (
                          <p key={`${selectedPost.id}-${index}`}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-950">
                      <div>
                        <p className="text-base font-black text-gray-950 dark:text-white">
                          열람 권한을 선택하면 본문이 표시됩니다.
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-gray-500 dark:text-gray-400">
                          게시글은 복사, 저장, 인쇄가 제한되며 계정 워터마크가 표시됩니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}
          </main>
        </div>
      </div>
      {pendingAction && (
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-gray-950/70 p-4">
          <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-black text-gray-950 dark:text-white">{pendingAction.title}</p>
            <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-300">
              {formatPoint(pendingAction.points)}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-500 dark:text-gray-400">
              {pendingAction.description}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="h-10 rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={runPendingAction}
                disabled={!!actionLoading}
                className="h-10 rounded-md border-none bg-amber-400 text-sm font-black text-gray-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                결제 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

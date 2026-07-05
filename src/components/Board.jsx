import { useEffect, useMemo, useState } from "react";
import { POINT_RULES, getPointRank } from "../hooks/usePointWallet";
import { STORAGE_KEYS, getStoredItem, setStoredItem } from "../storageKeys";
import { ADSDUCK_EMOTES } from "../data/adsduckEmotes";
import {
  createBoardPost,
  getBoardPosts,
  updateBoardPost,
  uploadBoardMediaFile,
} from "../api/adsduckApi";

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

const SORT_OPTIONS = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
];

const EMPTY_DRAFT = { title: "", content: "", media: [] };
const MAX_MEDIA_FILES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

const SEED_POSTS = [
  {
    id: "seed-anon-1",
    board: "anonymous",
    title: "조회수 기준보다 초반 반응이 더 중요하다는 말 맞나요?",
    content: "업로드 첫날에 댓글과 공유가 몰리면 이후 노출도 달라지는 것 같아서 경험담을 듣고 싶습니다.",
    authorId: "seed-user-1",
    authorName: "익명회원",
    authorPointBalance: 1800,
    createdAt: "2026-05-30T09:00:00.000Z",
    likes: 14,
    likedBy: [],
    penaltyPoints: 0,
    targetBalancePreview: 1800,
    comments: [
      {
        id: "seed-comment-1",
        authorId: "seed-user-3",
        authorName: "익명회원",
        authorPointBalance: 2100,
        targetBalancePreview: 2100,
        penaltyPoints: 0,
        content: "맞아요. 초반 1시간 지표가 꽤 크게 보이는 편입니다.",
        createdAt: "2026-05-30T10:20:00.000Z",
        replies: [
          {
            id: "seed-reply-1",
            authorId: "seed-user-4",
            authorName: "익명회원",
            authorPointBalance: 1200,
            targetBalancePreview: 1200,
            penaltyPoints: 0,
            content: "그래서 업로드 시간도 같이 맞추는 편이에요.",
            createdAt: "2026-05-30T10:44:00.000Z",
          },
        ],
      },
    ],
  },
  {
    id: "seed-real-1",
    board: "realname",
    title: "주최자 공모전 참고자료는 어떤 형식이 가장 편한가요?",
    content: "로고, 제품 컷, 금지 표현, 필수 해시태그가 한 번에 정리된 문서가 있으면 제작 시간이 줄었습니다.",
    authorId: "seed-user-2",
    authorName: "min.creator",
    authorPointBalance: 2400,
    createdAt: "2026-05-29T14:00:00.000Z",
    likes: 9,
    likedBy: [],
    penaltyPoints: 0,
    targetBalancePreview: 2400,
    comments: [],
  },
];

const REWARD_ITEMS = [
  { label: "글쓰기", value: `+${POINT_RULES.postReward}P` },
  { label: "댓글", value: `+${POINT_RULES.commentReward}P` },
  { label: "좋아요", value: `+${POINT_RULES.likeReward}P` },
  { label: "메시지", value: `-${POINT_RULES.messageCost}P` },
  { label: "공모전 참가", value: `-${POINT_RULES.contestEntryCost}P` },
  { label: "익명 벌금", value: `1시간 ${POINT_RULES.penaltyHourlyLimit}P` },
  { label: "선행 포인트", value: `${POINT_RULES.virtuePointCost.toLocaleString()}P / 1점` },
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

function readMessages() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.userMessages) || "[]");
  } catch {
    return [];
  }
}

function writePenaltyLedger(ledger) {
  setStoredItem(localStorage, STORAGE_KEYS.penaltyLedger, JSON.stringify(ledger));
}

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}

function createMediaId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function getEditedAt(item, { trustUpdatedAt = false } = {}) {
  const explicit = item?.editedAt || item?.edited_at || item?.modifiedAt || item?.modified_at;
  if (explicit) return explicit;
  const updatedAt = item?.updatedAt || item?.updated_at;
  if ((item?.isEdited || trustUpdatedAt) && updatedAt && updatedAt !== item?.createdAt) {
    return updatedAt;
  }
  return "";
}

function getCommentInputId(postId) {
  return `board-comment-input-${postId}`;
}

function getHourlyPenaltyUsed(userId) {
  if (!userId) return 0;
  const ledger = readPenaltyLedger();
  const cutoff = Date.now() - 60 * 60 * 1000;
  return (ledger[userId] || [])
    .filter((item) => new Date(item.createdAt).getTime() > cutoff)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function countThreads(post) {
  return (post.comments || []).reduce(
    (sum, comment) => sum + 1 + (comment.replies || []).length,
    0
  );
}

function makeDisplayName(board, user) {
  return board === "anonymous" ? "익명회원" : user.display_name || user.email || "사용자";
}

function BoardIcon({ name, className = "h-4 w-4" }) {
  const paths = {
    message: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
    penalty: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1v16",
    up: "M12 19V5m0 0-6 6m6-6 6 6",
    down: "M12 5v14m0 0 6-6m-6 6-6-6",
    send: "M22 2 11 13m11-11-7 20-4-9-9-4 20-7Z",
    check: "M20 6 9 17l-5-5",
    image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14m18 0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2m18 0-5.5-6-3.5 4.5-2.5-3L3 19m5-10.5h.01",
    video: "M15 10l4.5-2.5v9L15 14m0-4v4m0-4H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10",
    x: "M18 6 6 18M6 6l12 12",
    play: "M8 5v14l11-7-11-7Z",
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[name]} />
    </svg>
  );
}

export default function Board({ authSession, pointAccount, onRequireLogin, onToast, onOpenPoints }) {
  const [activeBoard, setActiveBoard] = useState("anonymous");
  const [sortMode, setSortMode] = useState("latest");
  const [posts, setPosts] = useState(readPosts);
  const [, setMessages] = useState(readMessages);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [comments, setComments] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyComposerId, setActiveReplyComposerId] = useState("");
  const [penaltyAmounts, setPenaltyAmounts] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [boardRemoteReady, setBoardRemoteReady] = useState(false);
  const [boardLoading, setBoardLoading] = useState(true);
  const [openActionKey, setOpenActionKey] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState("");
  const user = authSession?.user || null;
  const userId = user?.id || null;
  const wallet = pointAccount?.wallet || null;
  const hourlyPenaltyUsed = getHourlyPenaltyUsed(userId);
  const activeMeta = BOARD_TABS.find((tab) => tab.key === activeBoard) || BOARD_TABS[0];
  const emoteMap = useMemo(
    () => new Map(ADSDUCK_EMOTES.map((emote) => [emote.id, emote])),
    []
  );

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
        return (b.likes + countThreads(b)) - (a.likes + countThreads(a));
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeBoard, posts, sortMode]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId && post.board === activeBoard) || null,
    [activeBoard, posts, selectedPostId]
  );

  useEffect(() => {
    let active = true;

    getBoardPosts()
      .then((result) => {
        if (!active) return;
        const remotePosts = Array.isArray(result?.posts) ? result.posts : [];
        setPosts(remotePosts.length > 0 ? remotePosts : SEED_POSTS);
        setStoredItem(localStorage, STORAGE_KEYS.boardPosts, JSON.stringify(remotePosts.length > 0 ? remotePosts : SEED_POSTS));
        setBoardRemoteReady(true);
      })
      .catch(() => {
        if (!active) return;
        setBoardRemoteReady(false);
      })
      .finally(() => {
        if (active) setBoardLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const syncPostToServer = (post) => {
    if (!boardRemoteReady || !post?.id) return;
    updateBoardPost(post.id, post, authSession)
      .catch(() => onToast?.("게시글 변경사항을 저장하지 못했습니다. 잠시 후 다시 시도해주세요."));
  };

  const persistPosts = (updater, options = {}) => {
    let postToSync = null;
    setPosts((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (options.syncPostId) {
        postToSync = next.find((post) => post.id === options.syncPostId) || null;
      }
      setStoredItem(localStorage, STORAGE_KEYS.boardPosts, JSON.stringify(next));
      return next;
    });
    if (postToSync) syncPostToServer(postToSync);
  };

  const persistMessages = (updater) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setStoredItem(localStorage, STORAGE_KEYS.userMessages, JSON.stringify(next));
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

  const focusComposerInput = (inputId) => {
    if (typeof document === "undefined") return;
    const input = document.getElementById(inputId);
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => input.focus());
  };

  const focusCommentComposer = (postId) => {
    if (!requireActivity()) return;
    setActiveReplyComposerId("");
    setTimeout(() => focusComposerInput(getCommentInputId(postId)), 0);
  };

  const focusReplyComposer = (postId, commentId) => {
    if (!requireActivity()) return;
    setOpenActionKey("");
    setActiveReplyComposerId((currentId) => (currentId === commentId ? "" : commentId));
    setTimeout(() => focusComposerInput(getCommentInputId(postId)), 0);
  };

  const addPenaltyLedger = (amount) => {
    const ledger = readPenaltyLedger();
    ledger[userId] = [
      ...(ledger[userId] || []).filter((item) => new Date(item.createdAt).getTime() > Date.now() - 60 * 60 * 1000),
      { amount, createdAt: new Date().toISOString() },
    ];
    writePenaltyLedger(ledger);
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
    if (!requireActivity()) return;
    const title = draft.title.trim();
    const content = draft.content.trim();
    const draftMedia = draft.media || [];

    if (!title) {
      onToast?.("제목을 입력해주세요.");
      return;
    }
    if (!content && draftMedia.length === 0) {
      onToast?.("내용을 입력하거나 이미지/동영상을 첨부해주세요.");
      return;
    }

    let media = [];
    try {
      media = await Promise.all(draftMedia.map(async (item) => {
        if (item.kind === "emote") {
          return {
            id: item.id,
            kind: "emote",
            mediaType: "image",
            emoteId: item.emoteId,
            name: item.name,
          };
        }
        return uploadBoardMediaFile(item.file, authSession);
      }));
    } catch {
      onToast?.("첨부 파일 업로드에 실패했습니다. 네트워크와 파일 용량을 확인해주세요.");
      return;
    }

    const post = {
      id: `post-${Date.now()}`,
      board: activeBoard,
      title,
      content,
      authorId: userId,
      authorName: makeDisplayName(activeBoard, user),
      authorPointBalance: wallet?.balance || 0,
      targetBalancePreview: wallet?.balance || 0,
      virtueScore: wallet?.virtueScore || 0,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      penaltyPoints: 0,
      media,
      comments: [],
    };

    let savedPost = post;
    try {
      const result = await createBoardPost(post, authSession);
      savedPost = result?.post || post;
      setBoardRemoteReady(true);
    } catch {
      onToast?.("게시글을 저장하지 못했습니다. 다시 시도해주세요.");
      return;
    }

    persistPosts((prev) => [savedPost, ...prev]);
    setDraft(EMPTY_DRAFT);
    setComposerOpen(false);
    setSelectedPostId(savedPost.id);
    pointAccount?.addPoints(POINT_RULES.postReward, "게시글 작성 보상");
    onToast?.(`게시글 작성 보상 ${formatPoint(POINT_RULES.postReward)} 지급`);
  };

  const handleOpenComposer = () => {
    if (!requireActivity()) return;
    setComposerOpen((value) => !value);
  };

  const handleDraftMediaChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const availableSlots = MAX_MEDIA_FILES - (draft.media || []).length;
    if (availableSlots <= 0) {
      onToast?.(`첨부는 최대 ${MAX_MEDIA_FILES}개까지 가능합니다.`);
      return;
    }

    const accepted = [];
    const rejected = [];
    files.slice(0, availableSlots).forEach((file) => {
      const mediaType = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : "";
      const maxBytes = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

      if (!mediaType) {
        rejected.push(file.name);
        return;
      }
      if (file.size > maxBytes) {
        rejected.push(`${file.name}(${formatFileSize(maxBytes)} 초과)`);
        return;
      }

      accepted.push({
        id: createMediaId("upload"),
        kind: "upload",
        mediaType,
        mime: file.type,
        name: file.name,
        size: file.size,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (files.length > availableSlots) {
      onToast?.(`첨부는 최대 ${MAX_MEDIA_FILES}개까지 가능합니다.`);
    } else if (rejected.length > 0) {
      onToast?.(`첨부할 수 없는 파일이 있습니다: ${rejected.slice(0, 2).join(", ")}`);
    }

    if (accepted.length > 0) {
      setDraft((prev) => ({
        ...prev,
        media: [...(prev.media || []), ...accepted],
      }));
    }
  };

  const handleRemoveDraftMedia = (mediaId) => {
    setDraft((prev) => {
      const target = (prev.media || []).find((item) => item.id === mediaId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return {
        ...prev,
        media: (prev.media || []).filter((item) => item.id !== mediaId),
      };
    });
  };

  const handleAddEmote = (emote) => {
    if ((draft.media || []).length >= MAX_MEDIA_FILES) {
      onToast?.(`첨부는 최대 ${MAX_MEDIA_FILES}개까지 가능합니다.`);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      media: [
        ...(prev.media || []),
        {
          id: createMediaId("emote"),
          kind: "emote",
          mediaType: "image",
          emoteId: emote.id,
          name: emote.label,
        },
      ],
    }));
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
    )), { syncPostId: postId });
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
                authorId: userId,
                authorName: makeDisplayName(post.board, user),
                authorPointBalance: wallet?.balance || 0,
                targetBalancePreview: wallet?.balance || 0,
                virtueScore: wallet?.virtueScore || 0,
                penaltyPoints: 0,
                content,
                createdAt: new Date().toISOString(),
                replies: [],
              },
            ],
          }
        : post
    )), { syncPostId: postId });
    setComments((prev) => ({ ...prev, [postId]: "" }));
    setActiveReplyComposerId("");
    pointAccount?.addPoints(POINT_RULES.commentReward, "댓글 작성 보상");
    onToast?.(`댓글 보상 ${formatPoint(POINT_RULES.commentReward)} 지급`);
  };

  const handleReply = (postId, commentId, board) => {
    if (!requireActivity()) return;
    const draftKey = `reply:${commentId}`;
    const content = (replyDrafts[draftKey] || "").trim();
    if (!content) return;

    persistPosts((prev) => prev.map((post) => (
      post.id === postId
        ? {
            ...post,
            comments: (post.comments || []).map((comment) => (
              comment.id === commentId
                ? {
                    ...comment,
                    replies: [
                      ...(comment.replies || []),
                      {
                        id: `reply-${Date.now()}`,
                        authorId: userId,
                        authorName: makeDisplayName(board, user),
                        authorPointBalance: wallet?.balance || 0,
                        targetBalancePreview: wallet?.balance || 0,
                        virtueScore: wallet?.virtueScore || 0,
                        penaltyPoints: 0,
                        content,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }
                : comment
            )),
          }
        : post
    )), { syncPostId: postId });
    setReplyDrafts((prev) => ({ ...prev, [draftKey]: "" }));
    setActiveReplyComposerId("");
    pointAccount?.addPoints(POINT_RULES.commentReward, "대댓글 작성 보상");
    onToast?.(`대댓글 보상 ${formatPoint(POINT_RULES.commentReward)} 지급`);
  };

  const handleComposerSubmit = (post) => {
    const activeReplyComment = (post.comments || []).find((comment) => comment.id === activeReplyComposerId);

    if (activeReplyComment) {
      handleReply(post.id, activeReplyComment.id, post.board);
      return;
    }

    handleComment(post.id);
  };

  const applyPenaltyToContent = (target, nextBalance, amount) => {
    persistPosts((prev) => prev.map((post) => {
      if (post.id !== target.postId) return post;
      if (target.type === "post") {
        return {
          ...post,
          penaltyPoints: (post.penaltyPoints || 0) + amount,
          targetBalancePreview: nextBalance,
        };
      }
      return {
        ...post,
        comments: (post.comments || []).map((comment) => {
          if (comment.id !== target.commentId) return comment;
          if (target.type === "comment") {
            return {
              ...comment,
              penaltyPoints: (comment.penaltyPoints || 0) + amount,
              targetBalancePreview: nextBalance,
            };
          }
          return {
            ...comment,
            replies: (comment.replies || []).map((reply) => (
              reply.id === target.replyId
                ? {
                    ...reply,
                    penaltyPoints: (reply.penaltyPoints || 0) + amount,
                    targetBalancePreview: nextBalance,
                  }
                : reply
            )),
          };
        }),
      };
    }), { syncPostId: target.postId });
  };

  const applyVirtueToContent = (target, nextScore) => {
    persistPosts((prev) => prev.map((post) => {
      if (post.id !== target.postId) return post;
      if (target.type === "post") {
        return { ...post, virtueScore: nextScore };
      }
      return {
        ...post,
        comments: (post.comments || []).map((comment) => {
          if (comment.id !== target.commentId) return comment;
          if (target.type === "comment") {
            return { ...comment, virtueScore: nextScore };
          }
          return {
            ...comment,
            replies: (comment.replies || []).map((reply) => (
              reply.id === target.replyId ? { ...reply, virtueScore: nextScore } : reply
            )),
          };
        }),
      };
    }), { syncPostId: target.postId });
  };

  const handleVirtuePoint = (target, direction) => {
    if (!requireActivity()) return;
    const targetAuthorId = target.authorId || "";
    if (!targetAuthorId) {
      onToast?.("선행 포인트 대상을 확인할 수 없습니다.");
      return;
    }
    if (targetAuthorId === userId) {
      onToast?.("본인의 선행 포인트는 조정할 수 없습니다.");
      return;
    }

    const result = pointAccount?.adjustVirtuePoint?.(targetAuthorId, direction, target.balance || 0);
    if (!result?.ok) {
      onToast?.(result?.error || "선행 포인트 조정에 실패했습니다.");
      return;
    }
    const nextScore = result.targetWallet?.virtueScore ?? Number(target.virtueScore || 0) + result.delta;
    applyVirtueToContent(target, nextScore);
    onToast?.(
      result.delta > 0
        ? `선행 포인트를 1점 올렸습니다. ${formatPoint(POINT_RULES.virtuePointCost)} 사용`
        : `선행 포인트를 1점 내렸습니다. ${formatPoint(POINT_RULES.virtuePointCost)} 사용`
    );
  };

  const handlePenalty = (target) => {
    if (!requireActivity()) return;
    if (activeBoard !== "anonymous") {
      onToast?.("벌금은 익명 게시판에서만 줄 수 있습니다.");
      return;
    }

    const amount = Math.max(0, Number(penaltyAmounts[target.key]) || 0);
    const targetAuthorId = target.authorId || "";
    const fallbackBalance = Number(target.balance || 0);
    if (!targetAuthorId || amount <= 0) {
      onToast?.("벌금으로 사용할 포인트를 입력해주세요.");
      return;
    }
    if (targetAuthorId === userId) {
      onToast?.("내 글이나 댓글에는 벌금을 줄 수 없습니다.");
      return;
    }
    if (hourlyPenaltyUsed + amount > POINT_RULES.penaltyHourlyLimit) {
      onToast?.(`벌금은 1시간에 ${formatPoint(POINT_RULES.penaltyHourlyLimit)}까지 줄 수 있습니다.`);
      return;
    }

    const spendResult = pointAccount?.spendPoints(amount, "익명 게시판 벌금");
    if (!spendResult?.ok) {
      onToast?.(spendResult?.error || "포인트가 부족합니다.");
      return;
    }
    const targetResult = pointAccount?.penalizeUser?.(targetAuthorId, amount, fallbackBalance);
    if (!targetResult?.ok) {
      onToast?.(targetResult?.error || "상대 벌금 적용에 실패했습니다.");
      return;
    }

    applyPenaltyToContent(target, targetResult.wallet?.balance ?? fallbackBalance - amount, amount);
    addPenaltyLedger(amount);
    setPenaltyAmounts((prev) => ({ ...prev, [target.key]: "" }));
    setOpenActionKey("");
    onToast?.(`상대에게 벌금 ${formatPoint(amount)} 적용`);
  };

  const handleSendMessage = (target, draftKey) => {
    if (!requireActivity()) return;
    const content = (messageDrafts[draftKey] || "").trim();
    if (!content) return;
    if (!target.authorId || target.authorId === userId) {
      onToast?.("본인에게는 메시지를 보낼 수 없습니다.");
      return;
    }

    const spendResult = pointAccount?.spendPoints(POINT_RULES.messageCost, "유저 메시지 전송");
    if (!spendResult?.ok) {
      onToast?.(spendResult?.error || "포인트가 부족합니다.");
      return;
    }

    persistMessages((prev) => [
      {
        id: `message-${Date.now()}`,
        fromId: userId,
        fromName: user.display_name || user.email || "사용자",
        toId: target.authorId,
        toName: target.authorName || "사용자",
        content,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 80));
    setMessageDrafts((prev) => ({ ...prev, [draftKey]: "" }));
    setOpenActionKey("");
    onToast?.(`메시지를 보냈습니다. ${formatPoint(POINT_RULES.messageCost)} 사용`);
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

  const renderRankIcon = (rank) => {
    const starCount = Math.min(rank.stars || 1, 7);
    return (
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br ${rank.accent} text-gray-950 ring-1 ring-white/60 dark:ring-gray-700`}>
        <svg viewBox="0 0 32 32" className="h-3 w-3" aria-hidden="true">
          {Array.from({ length: starCount }).map((_, index) => {
            const angle = (Math.PI * 2 * index) / starCount - Math.PI / 2;
            const radius = starCount === 1 ? 0 : 9;
            const x = 16 + Math.cos(angle) * radius;
            const y = 16 + Math.sin(angle) * radius;
            return (
              <path
                key={index}
                d={`M ${x} ${y - 4} L ${x + 1.2} ${y - 1.2} L ${x + 4} ${y - 1.1} L ${x + 1.8} ${y + 0.8} L ${x + 2.5} ${y + 3.8} L ${x} ${y + 2.1} L ${x - 2.5} ${y + 3.8} L ${x - 1.8} ${y + 0.8} L ${x - 4} ${y - 1.1} L ${x - 1.2} ${y - 1.2} Z`}
                fill="currentColor"
              />
            );
          })}
        </svg>
      </span>
    );
  };

  const renderUserLine = (item, fallbackBalance = 0, { actions = [], trustUpdatedAt = false } = {}) => (
    (() => {
      const balance = item.authorId === userId && wallet
        ? wallet.balance
        : item?.targetBalancePreview ?? item?.authorPointBalance ?? fallbackBalance;
      const rank = getPointRank(balance);
      const virtueScore = item.authorId === userId && wallet
        ? wallet.virtueScore || 0
        : Number(item?.virtueScore || 0);
      const editedAt = getEditedAt(item, { trustUpdatedAt });
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-5 text-gray-400 dark:text-gray-500">
          <span className="font-semibold text-gray-700 dark:text-gray-200">{item.authorName || "사용자"}</span>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="inline-flex h-5 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              {action.label}
            </button>
          ))}
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-medium text-gray-500 dark:text-gray-400">
            {renderRankIcon(rank)}
            <span>{rank.label}</span>
          </span>
          <span>·</span>
          <span className={`font-medium ${
            virtueScore > 0
              ? "text-emerald-600 dark:text-emerald-300"
              : virtueScore < 0
              ? "text-red-600 dark:text-red-300"
              : "text-gray-400 dark:text-gray-500"
          }`}>
            선행 {virtueScore > 0 ? "+" : ""}{virtueScore}
          </span>
          {item.createdAt && (
            <>
              <span>·</span>
              <span>{formatDate(item.createdAt)}</span>
            </>
          )}
          {editedAt && (
            <>
              <span>·</span>
              <span className="font-bold text-amber-600 dark:text-amber-300" title={`수정 시간 ${formatDate(editedAt)}`}>
                수정됨
              </span>
            </>
          )}
        </div>
      );
    })()
  );

  const getMediaSource = (item) => {
    if (item.kind === "emote") {
      return emoteMap.get(item.emoteId)?.src || "";
    }
    return item.url || item.previewUrl || "";
  };

  const renderMediaItem = (item, { compact = false, removable = false } = {}) => {
    const source = getMediaSource(item);
    const isVideo = item.mediaType === "video";
    const isEmote = item.kind === "emote";
    const label = item.name || (isVideo ? "동영상" : "이미지");
    const baseClass = compact
      ? "h-16 w-20 rounded-md"
      : isEmote
      ? "h-28 rounded-md sm:h-32"
      : "max-h-[520px] rounded-md";

    return (
      <div
        key={item.id}
        className={`group relative overflow-hidden border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950 ${
          compact ? "inline-flex flex-shrink-0" : "flex items-center justify-center"
        }`}
      >
        {source ? (
          isVideo ? (
            <video
              src={source}
              className={`${baseClass} w-full bg-gray-950 object-cover`}
              controls={!compact}
              muted={compact}
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={source}
              alt={label}
              className={`${baseClass} ${isEmote ? "w-auto object-contain p-2" : "w-full object-cover"}`}
              loading="lazy"
            />
          )
        ) : (
          <div className={`${baseClass} flex w-full items-center justify-center text-gray-400`}>
            <BoardIcon name={isVideo ? "video" : "image"} />
          </div>
        )}

        {isVideo && compact && (
          <span className="absolute inset-0 flex items-center justify-center bg-gray-950/35 text-white">
            <BoardIcon name="play" className="h-5 w-5 fill-current" />
          </span>
        )}

        {!compact && (
          <span className="absolute bottom-2 left-2 rounded bg-gray-950/70 px-2 py-1 text-[11px] font-bold text-white">
            {isVideo ? "동영상" : isEmote ? "이모티콘" : "이미지"}
          </span>
        )}

        {removable && (
          <button
            type="button"
            onClick={() => handleRemoveDraftMedia(item.id)}
            className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-none bg-gray-950/80 text-white opacity-90 transition hover:bg-red-500"
            aria-label="첨부 삭제"
            title="첨부 삭제"
          >
            <BoardIcon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const renderMediaGallery = (items, options = {}) => {
    const mediaItems = items || [];
    if (mediaItems.length === 0) return null;

    if (options.compact) {
      return (
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
          {mediaItems.slice(0, 3).map((item) => renderMediaItem(item, { compact: true }))}
          {mediaItems.length > 3 && (
            <span className="inline-flex h-16 min-w-10 items-center justify-center rounded-md bg-gray-100 px-2 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              +{mediaItems.length - 3}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className={`mt-3 grid gap-2 ${mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {mediaItems.map((item) => renderMediaItem(item, options))}
      </div>
    );
  };

  const toggleActionPanel = (panelKey) => {
    if (!requireActivity()) return;
    setOpenActionKey((prev) => (prev === panelKey ? "" : panelKey));
  };

  const renderTargetActions = (target, { anonymous = false } = {}) => {
    if (!userId || target.authorId === userId) return null;

    const messageKey = `message:${target.key}`;
    const penaltyKey = `penalty:${target.key}`;
    const isMessageOpen = openActionKey === messageKey;
    const isPenaltyOpen = openActionKey === penaltyKey;
    const buttonClass = "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100";
    const penaltyButtonClass = "relative inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-bold text-red-600 transition hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-950/30";

    return (
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => toggleActionPanel(messageKey)}
            className={buttonClass}
            title="메시지"
            aria-label="메시지 보내기"
          >
            <BoardIcon name="message" />
          </button>
          {anonymous && (
            <button
              onClick={() => toggleActionPanel(penaltyKey)}
              className={penaltyButtonClass}
              title="벌금"
              aria-label="벌금 주기"
            >
              <BoardIcon name="penalty" className="h-3.5 w-3.5" />
              <span>벌금</span>
              {target.penaltyPoints > 0 && (
                <span className="rounded bg-red-100 px-1 text-[10px] font-black text-red-600 dark:bg-red-950 dark:text-red-200">
                  {formatPoint(target.penaltyPoints)}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => handleVirtuePoint(target, "up")}
            className={`${buttonClass} hover:border-emerald-200 hover:text-emerald-600 dark:hover:border-emerald-900 dark:hover:text-emerald-300`}
            title="선행 점수 올리기"
            aria-label="선행 점수 올리기"
          >
            <BoardIcon name="up" />
          </button>
          <button
            onClick={() => handleVirtuePoint(target, "down")}
            className={buttonClass}
            title="선행 점수 내리기"
            aria-label="선행 점수 내리기"
          >
            <BoardIcon name="down" />
          </button>
        </div>

        {isMessageOpen && (
          <div className="mt-2 flex gap-2">
            <input
              value={messageDrafts[messageKey] || ""}
              onChange={(event) => setMessageDrafts((prev) => ({ ...prev, [messageKey]: event.target.value }))}
              className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              placeholder={`메시지 입력 -${formatPoint(POINT_RULES.messageCost)}`}
            />
            <button
              onClick={() => handleSendMessage(target, messageKey)}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-none bg-gray-900 text-white dark:bg-white dark:text-gray-950"
              title="전송"
              aria-label="메시지 전송"
            >
              <BoardIcon name="send" />
            </button>
          </div>
        )}

        {anonymous && isPenaltyOpen && (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="rounded-md bg-red-50 px-2.5 py-2 text-[11px] font-semibold leading-5 text-red-600 dark:bg-red-950/30 dark:text-red-300">
              입력한 포인트만큼 내 포인트가 차감되고, 상대 포인트도 같은 만큼 차감됩니다.
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <div className="flex gap-2 sm:w-[240px]">
                <input
                  value={penaltyAmounts[target.key] || ""}
                  onChange={(event) => setPenaltyAmounts((prev) => ({ ...prev, [target.key]: event.target.value }))}
                  type="number"
                  min="1"
                  max={POINT_RULES.penaltyHourlyLimit}
                  placeholder="차감할 포인트"
                  className="h-9 min-w-0 flex-1 rounded-md border border-red-200 bg-white px-3 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-red-400 dark:border-red-900 dark:bg-gray-950 dark:text-gray-100"
                  aria-label="벌금 포인트"
                />
                <button
                  onClick={() => handlePenalty(target)}
                  className="inline-flex h-9 flex-shrink-0 items-center justify-center rounded-md border-none bg-red-500 px-3 text-xs font-bold text-white transition hover:bg-red-600"
                  title="벌금 적용"
                  aria-label="벌금 적용"
                >
                  벌금 적용
                </button>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                1시간 {formatPoint(hourlyPenaltyUsed)} / {formatPoint(POINT_RULES.penaltyHourlyLimit)} · 누적 벌금 {formatPoint(target.penaltyPoints)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const makePostTarget = (post) => ({
    type: "post",
    key: `post:${post.id}`,
    postId: post.id,
    authorId: post.authorId,
    authorName: post.authorName,
    balance: post.targetBalancePreview ?? post.authorPointBalance,
    penaltyPoints: post.penaltyPoints || 0,
    virtueScore: post.virtueScore || 0,
  });

  const makeCommentTarget = (post, comment, commentAuthorId) => ({
    type: "comment",
    key: `comment:${comment.id}`,
    postId: post.id,
    commentId: comment.id,
    authorId: commentAuthorId,
    authorName: comment.authorName,
    balance: comment.targetBalancePreview ?? comment.authorPointBalance ?? post.targetBalancePreview,
    penaltyPoints: comment.penaltyPoints || 0,
    virtueScore: comment.virtueScore || 0,
  });

  const makeReplyTarget = (post, comment, reply, replyAuthorId, commentTarget) => ({
    type: "reply",
    key: `reply:${reply.id}`,
    postId: post.id,
    commentId: comment.id,
    replyId: reply.id,
    authorId: replyAuthorId,
    authorName: reply.authorName,
    balance: reply.targetBalancePreview ?? reply.authorPointBalance ?? commentTarget.balance,
    penaltyPoints: reply.penaltyPoints || 0,
    virtueScore: reply.virtueScore || 0,
  });

  const renderPostDetail = (post) => {
    const postTarget = makePostTarget(post);
    const activeReplyComment = (post.comments || []).find((comment) => comment.id === activeReplyComposerId);
    const activeReplyDraftKey = activeReplyComment ? `reply:${activeReplyComment.id}` : "";
    const composerValue = activeReplyComment ? (replyDrafts[activeReplyDraftKey] || "") : (comments[post.id] || "");
    const composerPlaceholder = activeReplyComment ? "대댓글을 입력하세요." : "댓글을 입력하세요.";
    const composerReward = POINT_RULES.commentReward;

    return (
      <article className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
          <button
            type="button"
            onClick={() => {
              setSelectedPostId("");
              setOpenActionKey("");
              setActiveReplyComposerId("");
            }}
            className="mb-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록
          </button>
          {renderUserLine(post, 0, {
            actions: [
              { label: "댓글 달기", onClick: () => focusCommentComposer(post.id) },
            ],
          })}
          <h2 className="mt-2 text-lg font-black leading-7 text-gray-950 dark:text-white sm:text-xl [word-break:keep-all]">
            {post.title}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300">
            {post.content}
          </p>
          {renderMediaGallery(post.media)}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleLike(post.id)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              좋아요 {post.likes}
              <span className="ml-1 text-amber-500">+{formatPoint(POINT_RULES.likeReward)}</span>
            </button>
            {renderTargetActions(postTarget, { anonymous: post.board === "anonymous" })}
          </div>
        </div>

        <div className="px-3 py-3 sm:px-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:text-white">댓글 {countThreads(post)}</p>
          </div>

          {(post.comments || []).length > 0 && (
            <div className="mb-3">
              {(post.comments || []).map((comment) => {
                const commentAuthorId = comment.authorId || post.authorId;
                const commentTarget = makeCommentTarget(post, comment, commentAuthorId);

                return (
                  <div key={comment.id} className="border-t border-gray-100 py-2 first:border-t-0 dark:border-gray-800">
                    {renderUserLine({ ...comment, authorId: commentAuthorId }, post.targetBalancePreview, {
                      actions: [
                        { label: "대댓글 달기", onClick: () => focusReplyComposer(post.id, comment.id) },
                      ],
                      trustUpdatedAt: true,
                    })}
                    <p className="mt-1 text-[13px] leading-5 text-gray-700 dark:text-gray-300 sm:text-sm">{comment.content}</p>
                    {renderTargetActions(commentTarget, { anonymous: post.board === "anonymous" })}

                    {(comment.replies || []).length > 0 && (
                      <div className="mt-2 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                        {(comment.replies || []).map((reply) => {
                          const replyAuthorId = reply.authorId || commentAuthorId;
                          const replyTarget = makeReplyTarget(post, comment, reply, replyAuthorId, commentTarget);

                          return (
                            <div key={reply.id} className="py-1">
                              {renderUserLine({ ...reply, authorId: replyAuthorId }, commentTarget.balance, {
                                actions: [
                                  { label: "대댓글 달기", onClick: () => focusReplyComposer(post.id, comment.id) },
                                ],
                                trustUpdatedAt: true,
                              })}
                              <p className="mt-1 text-[13px] leading-5 text-gray-700 dark:text-gray-300 sm:text-sm">{reply.content}</p>
                              {renderTargetActions(replyTarget, { anonymous: post.board === "anonymous" })}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-0 z-20 -mx-3 flex gap-2 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:-mx-4 sm:px-4">
            {activeReplyComment && (
              <button
                type="button"
                onClick={() => setActiveReplyComposerId("")}
                className="inline-flex h-10 flex-shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
              >
                취소
              </button>
            )}
            <input
              id={getCommentInputId(post.id)}
              value={composerValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (activeReplyComment) {
                  setReplyDrafts((prev) => ({ ...prev, [activeReplyDraftKey]: nextValue }));
                  return;
                }
                setComments((prev) => ({ ...prev, [post.id]: nextValue }));
              }}
              className={`h-10 min-w-0 flex-1 rounded-md border px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:text-gray-100 ${
                activeReplyComment
                  ? "border-amber-300 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-500/10"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950"
              }`}
              placeholder={composerPlaceholder}
            />
            <button
              type="button"
              onClick={() => handleComposerSubmit(post)}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border-none bg-gray-950 text-white dark:bg-white dark:text-gray-950"
              title={`${activeReplyComment ? "대댓글 작성" : "댓글 작성"} ${formatPoint(composerReward)} 보상`}
              aria-label={`${activeReplyComment ? "대댓글 작성" : "댓글 작성"} ${formatPoint(composerReward)} 보상`}
            >
              <BoardIcon name="send" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">AdsDuck Community</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">
            게시판
          </h1>
          <p className="mt-1 hidden max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-400 sm:block">
            크리에이터들이 공모전 경험과 제작 팁을 나누는 공간입니다.
          </p>
        </div>
        <button
          onClick={handleOpenComposer}
          className="flex h-9 flex-shrink-0 items-center justify-center rounded-md border-none bg-amber-400 px-3 text-xs font-bold text-gray-950 transition hover:bg-amber-300"
        >
          글쓰기 +{formatPoint(POINT_RULES.postReward)}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <main className="min-w-0 space-y-3">
          <div className="sticky top-[var(--header-h,64px)] z-20 -mx-4 border-y border-gray-200 bg-[#f8fafc]/95 px-4 py-2 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 sm:mx-0 sm:rounded-md sm:border">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-1.5 overflow-x-auto">
                {BOARD_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveBoard(tab.key);
                      setSelectedPostId("");
                      setActiveReplyComposerId("");
                    }}
                    className={`h-8 flex-shrink-0 rounded-md border px-3 text-xs font-bold transition ${
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
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                  {activeMeta.description}
                </p>
                <div className="flex rounded-md border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-gray-900">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setSortMode(option.key)}
                      className={`h-7 rounded px-2.5 text-[11px] font-bold ${
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

          {boardLoading && (
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              게시글을 불러오는 중입니다.
            </div>
          )}

          {!boardLoading && !boardRemoteReady && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              게시판 연결이 불안정합니다. 현재 화면의 글은 다른 사용자와 공유되지 않을 수 있습니다.
            </div>
          )}

          {!userId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/70 dark:bg-amber-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-950 dark:text-white">
                    로그인하면 첫 가입 5,000P와 출석 보너스를 받을 수 있어요.
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                    글쓰기, 댓글, 좋아요 보상이 바로 지갑에 반영됩니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRequireLogin?.("login")}
                    className="h-9 rounded-md border-none bg-gray-950 px-3 text-xs font-bold text-white dark:bg-white dark:text-gray-950"
                  >
                    로그인
                  </button>
                  <button
                    onClick={() => onRequireLogin?.("signup")}
                    className="h-9 rounded-md border border-amber-300 bg-white px-3 text-xs font-bold text-amber-700 dark:border-amber-700 dark:bg-gray-950/30 dark:text-amber-300"
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
              className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-amber-500">{activeMeta.title}</p>
                  <h2 className="mt-0.5 text-base font-bold text-gray-950 dark:text-white">새 글 작성</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="h-8 rounded-md border-none bg-gray-100 px-3 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                >
                  닫기
                </button>
              </div>
              <label className="mb-2 block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="제목을 입력하세요"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">내용</span>
                <textarea
                  value={draft.content}
                  onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="공모전 후기, 질문, 제작 팁을 남겨보세요."
                />
              </label>
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-950/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    첨부 {draft.media.length}/{MAX_MEDIA_FILES}
                  </p>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600 transition hover:text-gray-950 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white">
                    <BoardIcon name="image" className="h-3.5 w-3.5" />
                    이미지/동영상
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="sr-only"
                      onChange={handleDraftMediaChange}
                    />
                  </label>
                </div>

                <div className="mt-2">
                  <p className="mb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">애즈덕 이모티콘</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {ADSDUCK_EMOTES.map((emote) => (
                      <button
                        key={emote.id}
                        type="button"
                        onClick={() => handleAddEmote(emote)}
                        className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white p-1 transition hover:border-amber-300 dark:border-gray-700 dark:bg-gray-900"
                        title={emote.label}
                        aria-label={emote.label}
                      >
                        <img src={emote.src} alt="" className="h-full w-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>

                {draft.media.length > 0 && (
                  <div className="mt-2">
                    {renderMediaGallery(draft.media, { removable: true })}
                  </div>
                )}
                <p className="mt-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  이미지 {formatFileSize(MAX_IMAGE_BYTES)} 이하, 동영상 {formatFileSize(MAX_VIDEO_BYTES)} 이하
                </p>
              </div>
              <button
                type="submit"
                className="mt-3 h-10 w-full rounded-md border-none bg-amber-400 text-sm font-bold text-gray-950 transition hover:bg-amber-300 disabled:opacity-60"
                disabled={pointAccount?.isActivityBlocked}
              >
                게시글 등록 +{formatPoint(POINT_RULES.postReward)}
              </button>
            </form>
          )}

          {selectedPost ? (
            renderPostDetail(selectedPost)
          ) : (
            <>
          {visiblePosts.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400">아직 글이 없습니다.</p>
              <button
                onClick={handleOpenComposer}
                className="mt-3 h-9 rounded-md border-none bg-amber-400 px-3 text-xs font-bold text-gray-950"
              >
                첫 글 쓰기
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {visiblePosts.map((post) => {
              const threadCount = countThreads(post);
              return (
                <article
                  key={post.id}
                  className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setOpenActionKey("");
                      setSelectedPostId(post.id);
                      setActiveReplyComposerId("");
                    }}
                    className="block w-full border-none bg-transparent px-3 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-900/70 sm:px-4"
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-black text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        {post.board === "anonymous" ? "익" : "실"}
                      </div>
                      <div className="min-w-0 flex-1">
                        {renderUserLine(post)}
                        <h3 className="mt-1 text-[15px] font-bold leading-6 text-gray-950 dark:text-white sm:text-base [word-break:keep-all]">
                          {post.title}
                        </h3>
                        <p className="mt-0.5 text-[13px] leading-5 text-gray-500 line-clamp-2 dark:text-gray-400 sm:text-sm">
                          {post.content}
                        </p>
                        {renderMediaGallery(post.media, { compact: true })}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          <span>좋아요 {post.likes}</span>
                          <span>댓글 {threadCount}</span>
                          {post.board === "anonymous" && post.penaltyPoints > 0 && (
                            <span className="text-red-500 dark:text-red-300">벌금 {formatPoint(post.penaltyPoints)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
            </>
          )}
        </main>

        <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-h,64px)+12px)]">
          <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">내 포인트</p>
            <p className={`mt-1 text-xl font-black ${wallet?.balance < 0 ? "text-red-500" : "text-amber-600 dark:text-amber-300"}`}>
              {wallet ? formatPoint(wallet.balance) : "-"}
            </p>
            {wallet?.balance < 0 && (
              <p className="mt-2 rounded-md bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600 dark:bg-red-950/30 dark:text-red-300">
                포인트가 마이너스라 게시판 활동이 제한됩니다.
              </p>
            )}
            {userId ? (
              <>
                <button
                  onClick={handleAttendance}
                  className="mt-3 h-9 w-full rounded-md border-none bg-amber-400 text-xs font-bold text-gray-950 hover:bg-amber-300"
                >
                  출석 보너스 받기
                </button>
                <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  연속 출석 {wallet?.attendanceDay || 0}일 · 10일차부터 500P 고정
                </p>
                <button
                  onClick={onOpenPoints}
                  className="mt-3 h-9 w-full rounded-md border border-gray-200 bg-white text-xs font-bold text-gray-700 transition hover:bg-gray-50 hover:text-gray-950 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  포인트 충전
                </button>
              </>
            ) : (
              <button
                onClick={() => onRequireLogin?.("login")}
                className="mt-3 h-9 w-full rounded-md border-none bg-gray-950 text-xs font-bold text-white dark:bg-white dark:text-gray-950"
              >
                로그인하고 시작
              </button>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-bold text-gray-950 dark:text-white">포인트 정책</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {REWARD_ITEMS.map((item) => (
                <div key={item.label} className="rounded-md bg-gray-50 p-2.5 dark:bg-gray-800/70">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-950 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-md bg-red-50 p-2.5 text-xs font-semibold leading-5 text-red-600 dark:bg-red-950/30 dark:text-red-300">
              익명 게시글, 댓글, 대댓글에는 내 포인트를 사용해 입력한 만큼 상대 포인트를 차감하는 벌금을 줄 수 있습니다.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

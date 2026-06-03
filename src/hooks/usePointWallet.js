import { useCallback, useMemo, useState } from "react";
import { STORAGE_KEYS, getStoredItem, setStoredItem } from "../storageKeys";

export const POINT_RULES = {
  signupBonus: 5000,
  contestEntryCost: 1000,
  postReward: 100,
  commentReward: 50,
  likeReward: 50,
  messageCost: 50,
  penaltyHourlyLimit: 300,
  virtuePointCost: 1000,
  virtueDailyLimit: 1,
  attendanceStep: 50,
  attendanceMaxBonus: 500,
  attendanceMaxBonusDay: 10,
};

export const POINT_RANKS = [
  { key: "star-1", label: "1성", stars: 1, accent: "from-gray-300 to-gray-100" },
  { key: "star-2", label: "2성", stars: 2, accent: "from-sky-300 to-cyan-100" },
  { key: "star-3", label: "3성", stars: 3, accent: "from-emerald-300 to-lime-100" },
  { key: "star-4", label: "4성", stars: 4, accent: "from-amber-300 to-yellow-100" },
  { key: "star-5", label: "5성", stars: 5, accent: "from-orange-300 to-amber-100" },
  { key: "zodiac-01", label: "염소자리", stars: 6, accent: "from-violet-400 to-fuchsia-200" },
  { key: "zodiac-02", label: "물병자리", stars: 7, accent: "from-cyan-400 to-blue-200" },
  { key: "zodiac-03", label: "물고기자리", stars: 8, accent: "from-teal-400 to-emerald-200" },
  { key: "zodiac-04", label: "양자리", stars: 9, accent: "from-red-400 to-orange-200" },
  { key: "zodiac-05", label: "황소자리", stars: 10, accent: "from-lime-400 to-amber-200" },
  { key: "zodiac-06", label: "쌍둥이자리", stars: 11, accent: "from-indigo-400 to-sky-200" },
  { key: "zodiac-07", label: "게자리", stars: 12, accent: "from-rose-400 to-pink-200" },
  { key: "zodiac-08", label: "사자자리", stars: 13, accent: "from-yellow-400 to-orange-200" },
  { key: "zodiac-09", label: "처녀자리", stars: 14, accent: "from-emerald-400 to-teal-200" },
  { key: "zodiac-10", label: "천칭자리", stars: 15, accent: "from-purple-400 to-indigo-200" },
  { key: "zodiac-11", label: "전갈자리", stars: 16, accent: "from-red-500 to-fuchsia-300" },
  { key: "zodiac-12", label: "사수자리", stars: 17, accent: "from-blue-500 to-violet-300" },
  { key: "max-ursa", label: "북두칠성", stars: 18, accent: "from-amber-200 via-white to-sky-200" },
];

export function getPointRank(balance = 0) {
  const tier = Math.floor(Math.max(0, Number(balance) || 0) / 3000);
  return POINT_RANKS[Math.min(tier, POINT_RANKS.length - 1)];
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffDays(fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return null;
  return Math.round((to - from) / 86400000);
}

function getAttendanceBonus(streakDay) {
  const cappedDay = Math.min(streakDay, POINT_RULES.attendanceMaxBonusDay);
  return Math.min(
    cappedDay * POINT_RULES.attendanceStep,
    POINT_RULES.attendanceMaxBonus
  );
}

function readWallets() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.pointWallets) || "{}");
  } catch {
    return {};
  }
}

function makeSignupWallet(session) {
  return {
    balance: POINT_RULES.signupBonus,
    virtueScore: 0,
    virtueVotes: [],
    attendanceDay: 0,
    lastAttendanceDate: null,
    marketingConsent: !!session?.marketingConsent || !!session?.user?.marketing_consent,
    transactions: [
      {
        id: `signup-${Date.now()}`,
        type: "bonus",
        amount: POINT_RULES.signupBonus,
        label: "첫 가입 혜택",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function makePenaltyWallet(startingBalance = 0) {
  return {
    balance: Number(startingBalance || 0),
    virtueScore: 0,
    virtueVotes: [],
    attendanceDay: 0,
    lastAttendanceDate: null,
    marketingConsent: false,
    transactions: [],
  };
}

export function usePointWallet(session) {
  const [wallets, setWallets] = useState(readWallets);
  const userId = session?.user?.id || null;

  const updateWallet = useCallback((updater) => {
    if (!userId) return { ok: false, error: "로그인이 필요합니다." };

    let result = { ok: false, error: "처리하지 못했습니다." };
    setWallets((prev) => {
      const current = prev[userId] || makeSignupWallet(session);
      const updated = updater(current);
      if (!updated?.ok) {
        result = updated || result;
        return prev;
      }
      const nextWallet = updated.wallet;
      const next = { ...prev, [userId]: nextWallet };
      setStoredItem(localStorage, STORAGE_KEYS.pointWallets, JSON.stringify(next));
      result = { ...updated, wallet: nextWallet };
      return next;
    });
    return result;
  }, [session, userId]);

  const addPoints = useCallback((amount, label, type = "earn") => {
    const value = Math.max(0, Number(amount) || 0);
    return updateWallet((wallet) => ({
      ok: true,
      wallet: {
        ...wallet,
        balance: wallet.balance + value,
        transactions: [
          {
            id: `${type}-${Date.now()}`,
            type,
            amount: value,
            label,
            createdAt: new Date().toISOString(),
          },
          ...(wallet.transactions || []),
        ].slice(0, 30),
      },
    }));
  }, [updateWallet]);

  const spendPoints = useCallback((amount, label, options = {}) => {
    const value = Math.max(0, Number(amount) || 0);
    return updateWallet((wallet) => {
      if (!options.allowNegative && wallet.balance < value) {
        return { ok: false, error: "포인트가 부족합니다." };
      }
      return {
        ok: true,
        wallet: {
          ...wallet,
          balance: wallet.balance - value,
          transactions: [
            {
              id: `spend-${Date.now()}`,
              type: "spend",
              amount: -value,
              label,
              createdAt: new Date().toISOString(),
            },
            ...(wallet.transactions || []),
          ].slice(0, 30),
        },
      };
    });
  }, [updateWallet]);

  const chargePoints = useCallback((amount) => {
    const value = Math.max(0, Number(amount) || 0);
    if (!value) return { ok: false, error: "충전 금액을 입력해주세요." };
    return addPoints(value, `포인트 충전 ${value.toLocaleString()}원`, "charge");
  }, [addPoints]);

  const checkAttendance = useCallback(() => {
    const date = todayKey();
    return updateWallet((wallet) => {
      if (wallet.lastAttendanceDate === date) {
        return { ok: false, error: "오늘 출석 보너스를 이미 받았습니다." };
      }

      const missedDays = diffDays(wallet.lastAttendanceDate, date);
      const keptStreak = missedDays === 1;
      const nextDay = keptStreak ? (wallet.attendanceDay || 0) + 1 : 1;
      const bonus = getAttendanceBonus(nextDay);
      return {
        ok: true,
        bonus,
        day: nextDay,
        reset: !!wallet.lastAttendanceDate && !keptStreak,
        wallet: {
          ...wallet,
          balance: wallet.balance + bonus,
          attendanceDay: nextDay,
          lastAttendanceDate: date,
          transactions: [
            {
              id: `attendance-${Date.now()}`,
              type: "bonus",
              amount: bonus,
              label: `출석 ${nextDay}일차 보너스`,
              createdAt: new Date().toISOString(),
            },
            ...(wallet.transactions || []),
          ].slice(0, 30),
        },
      };
    });
  }, [updateWallet]);

  const penalizeUser = useCallback((targetUserId, amount, fallbackBalance = 0) => {
    const value = Math.max(0, Number(amount) || 0);
    if (!targetUserId || !value) return { ok: false, error: "벌점 대상을 확인할 수 없습니다." };

    let result = { ok: false, error: "벌점을 적용하지 못했습니다." };
    setWallets((prev) => {
      const targetWallet = prev[targetUserId] || makePenaltyWallet(fallbackBalance);
      const nextWallet = {
        ...targetWallet,
        balance: targetWallet.balance - value,
        transactions: [
          {
            id: `penalty-${Date.now()}`,
            type: "penalty",
            amount: -value,
            label: "익명 게시판 벌점",
            createdAt: new Date().toISOString(),
          },
          ...(targetWallet.transactions || []),
        ].slice(0, 30),
      };
      const next = { ...prev, [targetUserId]: nextWallet };
      setStoredItem(localStorage, STORAGE_KEYS.pointWallets, JSON.stringify(next));
      result = { ok: true, wallet: nextWallet };
      return next;
    });
    return result;
  }, []);

  const adjustVirtuePoint = useCallback((targetUserId, direction, fallbackBalance = 0) => {
    const delta = direction === "up" ? 1 : direction === "down" ? -1 : 0;
    if (!userId) return { ok: false, error: "로그인이 필요합니다." };
    if (!targetUserId || !delta) return { ok: false, error: "선행 포인트 대상을 확인할 수 없습니다." };
    if (targetUserId === userId) return { ok: false, error: "본인의 선행 포인트는 조정할 수 없습니다." };

    const date = todayKey();
    const currentWallet = wallets[userId] || makeSignupWallet(session);
    const usedToday = (currentWallet.virtueVotes || []).filter((item) => item.date === date).length;
    if (usedToday >= POINT_RULES.virtueDailyLimit) {
      return { ok: false, error: "선행 포인트는 하루 1번만 사용할 수 있습니다." };
    }
    if (currentWallet.balance < POINT_RULES.virtuePointCost) {
      return { ok: false, error: "선행 포인트 조정에는 1,000P가 필요합니다." };
    }

    let result = { ok: false, error: "선행 포인트를 조정하지 못했습니다." };
    setWallets((prev) => {
      const voterWallet = prev[userId] || makeSignupWallet(session);
      const targetWallet = prev[targetUserId] || makePenaltyWallet(fallbackBalance);
      const nextVoterWallet = {
        ...voterWallet,
        balance: voterWallet.balance - POINT_RULES.virtuePointCost,
        virtueVotes: [
          { targetUserId, delta, date, createdAt: new Date().toISOString() },
          ...(voterWallet.virtueVotes || []),
        ].slice(0, 60),
        transactions: [
          {
            id: `virtue-spend-${Date.now()}`,
            type: "spend",
            amount: -POINT_RULES.virtuePointCost,
            label: delta > 0 ? "선행 포인트 올리기" : "선행 포인트 내리기",
            createdAt: new Date().toISOString(),
          },
          ...(voterWallet.transactions || []),
        ].slice(0, 30),
      };
      const nextTargetWallet = {
        ...targetWallet,
        virtueScore: Number(targetWallet.virtueScore || 0) + delta,
      };
      const next = {
        ...prev,
        [userId]: nextVoterWallet,
        [targetUserId]: nextTargetWallet,
      };
      setStoredItem(localStorage, STORAGE_KEYS.pointWallets, JSON.stringify(next));
      result = { ok: true, wallet: nextVoterWallet, targetWallet: nextTargetWallet, delta };
      return next;
    });
    return result;
  }, [session, userId, wallets]);

  const wallet = useMemo(
    () => (userId ? wallets[userId] || makeSignupWallet(session) : null),
    [session, userId, wallets]
  );
  const isActivityBlocked = !!wallet && wallet.balance < 0;

  return useMemo(() => ({
    wallet,
    userId,
    isActivityBlocked,
    addPoints,
    spendPoints,
    chargePoints,
    checkAttendance,
    penalizeUser,
    adjustVirtuePoint,
  }), [addPoints, adjustVirtuePoint, chargePoints, checkAttendance, isActivityBlocked, penalizeUser, spendPoints, userId, wallet]);
}

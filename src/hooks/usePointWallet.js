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
  attendanceStep: 50,
  attendanceMaxBonus: 500,
  attendanceMaxBonusDay: 10,
};

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
  }), [addPoints, chargePoints, checkAttendance, isActivityBlocked, penalizeUser, spendPoints, userId, wallet]);
}

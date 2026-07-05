import { useEffect, useMemo, useState } from "react";
import { getPointWallet } from "../api/adsduckApi";
import { POINT_RULES } from "../hooks/usePointWallet";

const EMPTY_TRANSACTIONS = [];

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
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
  return Math.min(cappedDay * POINT_RULES.attendanceStep, POINT_RULES.attendanceMaxBonus);
}

function WalletIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12V7a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V8m15 6h.01" />
    </svg>
  );
}

export default function PointCharge({ authSession, pointAccount, onRequireLogin, onToast, onOpenTerms }) {
  const [serverState, setServerState] = useState({ userId: null, wallet: null, transactions: [] });
  const user = authSession?.user || null;
  const userId = user?.id || null;
  const localWallet = pointAccount?.wallet || null;
  const serverWallet = serverState.userId === userId ? serverState.wallet : null;
  const serverTransactions = serverState.userId === userId ? serverState.transactions : EMPTY_TRANSACTIONS;
  const wallet = useMemo(
    () => (serverWallet ? { ...(localWallet || {}), ...serverWallet } : localWallet),
    [localWallet, serverWallet]
  );
  const today = todayKey();
  const alreadyCheckedIn = !!user && wallet?.lastAttendanceDate === today;
  const missedDays = diffDays(wallet?.lastAttendanceDate, today);
  const keepsStreak = missedDays === 1;
  const nextAttendanceDay = alreadyCheckedIn
    ? wallet?.attendanceDay || 0
    : keepsStreak
      ? (wallet?.attendanceDay || 0) + 1
      : 1;
  const nextBonus = getAttendanceBonus(nextAttendanceDay || 1);

  const recentTransactions = useMemo(() => (
    serverTransactions.length > 0
      ? serverTransactions.slice(0, 5).map((item) => ({
          id: item.id,
          amount: item.amount,
          label: item.description || item.type,
        }))
      : wallet?.transactions?.slice(0, 5) || []
  ), [serverTransactions, wallet]);

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    getPointWallet(authSession)
      .then((data) => {
        if (cancelled) return;
        setServerState({
          userId,
          wallet: data.wallet || null,
          transactions: data.transactions || [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setServerState({ userId, wallet: null, transactions: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authSession, userId]);

  const handleAttendance = () => {
    if (!user) {
      onRequireLogin?.("login");
      return;
    }
    if (alreadyCheckedIn) {
      onToast?.("오늘은 이미 출석 보너스를 받았습니다.");
      return;
    }

    const result = pointAccount?.checkAttendance();
    if (result?.ok) {
      setServerState((prev) => ({ ...prev, userId, wallet: null }));
      onToast?.(`연속 출석 ${result.day}일차 보너스 ${formatPoint(result.bonus)} 지급`);
      return;
    }

    onToast?.(result?.error || "출석 보너스를 받을 수 없습니다.", "error");
  };

  return (
    <section className="bg-[#f8fafc] py-6 dark:bg-gray-950 sm:py-10">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <main className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">Points</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">
                포인트
              </h1>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                현금 충전은 현재 제공하지 않습니다. 포인트는 가입, 출석, 글쓰기, 댓글, 좋아요 활동으로 받을 수 있습니다.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <WalletIcon />
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-900/20">
            <p className="text-sm font-black text-gray-950 dark:text-white">오늘의 출석 보너스</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-white p-3 dark:bg-gray-950/70">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">연속 출석</p>
                <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
                  {wallet?.attendanceDay || 0}일
                </p>
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-gray-950/70">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {alreadyCheckedIn ? "오늘 받은 보너스" : "받을 보너스"}
                </p>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-300">
                  {formatPoint(nextBonus)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAttendance}
              disabled={!!user && alreadyCheckedIn}
              className="mt-4 h-11 w-full rounded-md border-none bg-amber-400 px-4 text-sm font-black text-gray-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
            >
              {!user ? "로그인하고 출석 보너스 받기" : alreadyCheckedIn ? "오늘은 이미 받았습니다" : "출석 보너스 받기"}
            </button>
            <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              10일차부터 출석 보너스는 500P로 고정됩니다.
            </p>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
            <p className="text-sm font-black text-gray-950 dark:text-white">활동 보상</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ["글쓰기", POINT_RULES.postReward],
                ["댓글", POINT_RULES.commentReward],
                ["좋아요", POINT_RULES.likeReward],
              ].map(([label, points]) => (
                <div key={label} className="rounded-md bg-white p-3 dark:bg-gray-900">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">+{formatPoint(points)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onOpenTerms?.()}
              className="mt-4 inline-flex items-center gap-1.5 border-none bg-transparent p-0 text-xs font-bold text-gray-500 transition hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-300"
            >
              포인트 운영정책 보기
            </button>
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">현재 포인트</p>
            <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-300">
              {wallet ? formatPoint(wallet.balance) : "-"}
            </p>
            {!user && (
              <button
                onClick={() => onRequireLogin?.("login")}
                className="mt-3 h-9 w-full rounded-md border-none bg-amber-400 text-xs font-bold text-gray-950 hover:bg-amber-300"
              >
                로그인
              </button>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-bold text-gray-950 dark:text-white">최근 포인트 내역</p>
            <div className="mt-3 space-y-2">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 dark:border-gray-800">
                    <span className="min-w-0 text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">{item.label}</span>
                    <span className={`shrink-0 text-xs font-black ${item.amount >= 0 ? "text-amber-600 dark:text-amber-300" : "text-red-500 dark:text-red-300"}`}>
                      {item.amount >= 0 ? "+" : ""}
                      {formatPoint(item.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-gray-50 p-3 text-xs font-semibold text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  포인트 내역이 없습니다.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";
import { createPointChargeCheckout } from "../api/adsduckApi";

const PRESET_AMOUNTS = [1000, 5000, 10000, 30000, 50000];

function formatKrw(value) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

function getCheckoutUrl(checkout) {
  return (
    checkout?.checkoutUrl ||
    checkout?.paymentUrl ||
    checkout?.url ||
    checkout?.session?.url ||
    checkout?.data?.checkoutUrl ||
    ""
  );
}

function WalletIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12V7a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V8m15 6h.01" />
    </svg>
  );
}

export default function PointCharge({ authSession, pointAccount, onRequireLogin, onToast }) {
  const [amount, setAmount] = useState("10000");
  const [loading, setLoading] = useState(false);
  const user = authSession?.user || null;
  const wallet = pointAccount?.wallet || null;

  const normalizedAmount = useMemo(() => Math.floor(Number(amount || 0)), [amount]);
  const validAmount = Number.isFinite(normalizedAmount) && normalizedAmount >= 1000;
  const recentTransactions = wallet?.transactions?.slice(0, 5) || [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      onRequireLogin?.("login");
      return;
    }
    if (!validAmount) {
      onToast?.("충전 금액은 1,000원 이상 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const checkout = await createPointChargeCheckout(normalizedAmount, authSession);
      const checkoutUrl = getCheckoutUrl(checkout);
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      onToast?.("결제 세션이 생성되었습니다.");
    } catch (error) {
      onToast?.(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#f8fafc] py-6 dark:bg-gray-950 sm:py-10">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <main className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">Points</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">
                포인트 충전
              </h1>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                결제 금액과 동일하게 포인트가 충전됩니다. 1원은 1P로 반영됩니다.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <WalletIcon />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-gray-500 dark:text-gray-400" htmlFor="point-charge-amount">
                충전 금액
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="point-charge-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="number"
                  min="1000"
                  step="100"
                  inputMode="numeric"
                  className="h-11 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm font-bold text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                  placeholder="10000"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 rounded-md border-none bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                >
                  {loading ? "결제 준비 중" : "결제 페이지로 이동"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className={`h-9 rounded-md border text-xs font-bold transition ${
                    normalizedAmount === preset
                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {formatKrw(preset)}
                </button>
              ))}
            </div>

            <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">결제 예정 금액</span>
                <span className="text-sm font-black text-gray-950 dark:text-white">{formatKrw(validAmount ? normalizedAmount : 0)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">충전 예정 포인트</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-300">{formatPoint(validAmount ? normalizedAmount : 0)}</span>
              </div>
            </div>
          </form>
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

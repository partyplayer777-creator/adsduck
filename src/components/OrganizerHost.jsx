import { useState } from "react";
import {
  ORGANIZER_CONTACT_URL,
  findOrganizerPaymentCode,
  formatKrw,
  normalizePaymentCode,
} from "../data/organizerPaymentCodes";

const emptyBusinessForm = {
  businessNumber: "",
  startDate: "",
  representativeName: "",
  businessName: "",
};

function StatusPill({ verified, pending }) {
  const tone = verified
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
    : pending
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
    : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${tone}`}>
      {verified ? "확인 완료" : pending ? "확인 대기" : "확인 필요"}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function MoneyRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0 dark:border-gray-800">
      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-bold ${accent ? "text-amber-600 dark:text-amber-300" : "text-gray-950 dark:text-white"}`}>
        {formatKrw(value)}
      </span>
    </div>
  );
}

function PaymentBreakdown({ paymentCode }) {
  if (!paymentCode) return null;

  return (
    <div className="border-y border-gray-100 px-1 py-1 dark:border-gray-800">
      <MoneyRow label="결제 금액" value={paymentCode.totalAmount} accent />
      <MoneyRow label="플랫폼 이용료 19.7%" value={paymentCode.serviceFeeAmount} />
      <MoneyRow label="상금 및 참여 보상 재원 80.3%" value={paymentCode.escrowAmount} />
    </div>
  );
}

function PaymentModal({ open, paymentCode, loading, onClose, onPay }) {
  if (!open || !paymentCode) return null;

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center px-4">
      <button
        className="absolute inset-0 cursor-default border-none bg-gray-950/70"
        onClick={onClose}
        aria-label="결제 모달 닫기"
      />
      <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-500">Payment</p>
            <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">공모전 주최 결제</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {paymentCode.code} 코드 금액으로 결제를 진행합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border-none bg-transparent p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 rounded-md bg-amber-50 p-4 dark:bg-amber-900/20">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">결제 예정 금액</p>
          <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
            {formatKrw(paymentCode.totalAmount)}
          </p>
        </div>

        <PaymentBreakdown paymentCode={paymentCode} />

        <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          결제가 완료되면 담당자가 공모전 등록 절차를 안내합니다. 수상자 지급액은 관련 세법에 따른 공제 절차를 거쳐 지급됩니다.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="h-10 rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            onClick={onPay}
            disabled={loading}
            className="h-10 rounded-md border-none bg-amber-400 text-sm font-bold text-gray-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "결제 준비 중" : "결제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrganizerHost({ onToast, onBack }) {
  const [verificationMethod, setVerificationMethod] = useState("business");
  const [businessForm, setBusinessForm] = useState(emptyBusinessForm);
  const [verification, setVerification] = useState({ verified: false, pending: false, label: "" });
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [paymentCode, setPaymentCode] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const isVerified = verification.verified;

  const updateBusinessForm = (key, value) => {
    setBusinessForm((prev) => ({ ...prev, [key]: value }));
    setVerification((prev) => ({ ...prev, verified: false, label: "" }));
  };

  const handleBusinessVerify = async (event) => {
    event.preventDefault();
    setVerificationLoading(true);
    try {
      const businessNumber = String(businessForm.businessNumber || "").replace(/\D/g, "");
      const startDate = String(businessForm.startDate || "").replace(/\D/g, "");
      const representativeName = String(businessForm.representativeName || "").trim();
      if (businessNumber.length !== 10 || startDate.length !== 8 || representativeName.length < 2) {
        throw new Error("사업자등록번호, 개업일자, 대표자명을 확인해주세요.");
      }
      setVerification({
        verified: true,
        pending: false,
        type: "business",
        label: `사업자 ${businessNumber.slice(0, 3)}-${businessNumber.slice(3, 5)}-${businessNumber.slice(5)} 확인 완료`,
      });
      onToast?.("사업자 확인이 완료되었습니다.");
    } catch (error) {
      setVerification({ verified: false, pending: false, label: "" });
      onToast?.(error.message);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handlePassVerify = async () => {
    setVerificationLoading(true);
    try {
      setVerification({
        verified: true,
        pending: false,
        type: "pass",
        label: "PASS 본인인증 완료",
      });
      onToast?.("PASS 본인인증이 완료되었습니다.");
    } catch (error) {
      setVerification({ verified: false, pending: false, label: "" });
      onToast?.(error.message);
    } finally {
      setVerificationLoading(false);
    }
  };

  const requireVerification = () => {
    if (isVerified) return true;
    onToast?.("주최자 확인 후 진행할 수 있습니다.");
    return false;
  };

  const handleContact = () => {
    if (!requireVerification()) return;
    window.open(ORGANIZER_CONTACT_URL, "_blank", "noopener,noreferrer");
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();

    const normalizedCode = normalizePaymentCode(code);
    if (!normalizedCode) {
      onToast?.("결제 코드를 입력해주세요.");
      return;
    }

    setCodeLoading(true);
    try {
      const found = findOrganizerPaymentCode(normalizedCode);
      if (!found) {
        throw new Error("유효하지 않은 결제 코드입니다.");
      }
      setPaymentCode(found);
      setPaymentModalOpen(true);
      onToast?.("결제 코드가 확인되었습니다.");
    } catch (error) {
      setPaymentCode(null);
      onToast?.(error.message);
    } finally {
      setCodeLoading(false);
    }
  };

  const handlePay = async () => {
    if (!paymentCode) return;
    setPaymentLoading(true);
    window.alert(`결제 모듈은 연동 후 적용 예정입니다.\n\n결제 코드: ${paymentCode.code}\n결제 예정 금액: ${formatKrw(paymentCode.totalAmount)}`);
    setPaymentLoading(false);
  };

  return (
    <section className="bg-[#f8fafc] py-10 dark:bg-gray-950 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-500 transition hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19 8 12l7-7" />
          </svg>
          돌아가기
        </button>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-500">Organizer</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-3xl">
            공모전 주최하기
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 sm:text-base">
            주최자 확인이 완료되면 공모전 문의가 열립니다. 발급받은 결제 코드는 인증 여부와 관계없이 바로 입력할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-950 dark:text-white">주최자 확인</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  확인이 완료되면 공모전 문의하기가 열립니다.
                </p>
              </div>
              <StatusPill verified={verification.verified} pending={verification.pending} />
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {[
                { key: "business", label: "사업자" },
                { key: "pass", label: "PASS" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setVerificationMethod(item.key);
                    setVerification({ verified: false, pending: false, label: "" });
                  }}
                  className={`h-9 rounded-md border-none text-sm font-bold transition ${
                    verificationMethod === item.key
                      ? "bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-white"
                      : "bg-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {verificationMethod === "business" ? (
              <form onSubmit={handleBusinessVerify} className="space-y-4">
                <Field label="사업자등록번호">
                  <input
                    value={businessForm.businessNumber}
                    onChange={(event) => updateBusinessForm("businessNumber", event.target.value)}
                    inputMode="numeric"
                    placeholder="000-00-00000"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                  />
                </Field>
                <Field label="개업일자">
                  <input
                    value={businessForm.startDate}
                    onChange={(event) => updateBusinessForm("startDate", event.target.value)}
                    inputMode="numeric"
                    placeholder="YYYYMMDD"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                  />
                </Field>
                <Field label="대표자명">
                  <input
                    value={businessForm.representativeName}
                    onChange={(event) => updateBusinessForm("representativeName", event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                  />
                </Field>
                <Field label="상호명">
                  <input
                    value={businessForm.businessName}
                    onChange={(event) => updateBusinessForm("businessName", event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={verificationLoading}
                  className="h-10 w-full rounded-md border-none bg-gray-950 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                >
                  {verificationLoading ? "확인 중" : "사업자 확인하기"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm font-bold text-gray-950 dark:text-white">개인 주최자 본인인증</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    사업자등록번호가 없는 주최자는 PASS 인증으로 본인 여부를 확인합니다.
                  </p>
                </div>
                <button
                  onClick={handlePassVerify}
                  disabled={verificationLoading}
                  className="h-10 w-full rounded-md border-none bg-gray-950 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                >
                  {verificationLoading ? "확인 중" : "PASS 본인인증하기"}
                </button>
              </div>
            )}

            {verification.label && (
              <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                {verification.label}
              </p>
            )}
          </div>

          <div className="space-y-6">
            <div className={`grid gap-4 ${isVerified ? "sm:grid-cols-2" : "grid-cols-1"}`}>
              {isVerified && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-gray-950 dark:text-white">공모전 문의하기</h2>
                  <p className="mt-2 min-h-[60px] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    주최 목적, 예산, 일정, 상품 정보를 전달하면 담당자가 공모전 구성과 결제 코드를 안내합니다.
                  </p>
                  <button
                    onClick={handleContact}
                    className="mt-4 h-10 w-full rounded-md border-none bg-amber-400 text-sm font-bold text-gray-950 transition hover:bg-amber-300"
                  >
                    공모전 주최 문의
                  </button>
                </div>
              )}

              <form
                onSubmit={handleCodeSubmit}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h1a2 2 0 0 1 2 2v2m0 4v2a2 2 0 0 1-2 2h-1m-6 0H8a2 2 0 0 1-2-2v-2m0-4V9a2 2 0 0 1 2-2h1m3 0v12" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-950 dark:text-white">결제 코드 입력하기</h2>
                <p className="mt-2 min-h-[60px] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  공모전 문의 후 담당자에게 받은 결제 코드를 입력하면 해당 코드 금액으로 결제 모달이 열립니다.
                </p>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="ADSDUCK-1000K"
                  className="mt-4 h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm font-bold uppercase tracking-wide text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600"
                />
                <button
                  type="submit"
                  disabled={codeLoading}
                  className="mt-3 h-10 w-full rounded-md border-none bg-gray-950 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                >
                  {codeLoading ? "코드 확인 중" : "결제 코드 확인"}
                </button>
              </form>
            </div>

            {paymentCode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-900/10 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">
                      결제 페이지
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                      {paymentCode.label}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      코드 확인이 완료되어 결제 금액이 확정되었습니다.
                    </p>
                  </div>
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="h-10 rounded-md border-none bg-amber-400 px-4 text-sm font-bold text-gray-950 transition hover:bg-amber-300"
                  >
                    결제 모달 열기
                  </button>
                </div>
                <div className="mt-5">
                  <PaymentBreakdown paymentCode={paymentCode} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        paymentCode={paymentCode}
        loading={paymentLoading}
        onClose={() => setPaymentModalOpen(false)}
        onPay={handlePay}
      />
    </section>
  );
}

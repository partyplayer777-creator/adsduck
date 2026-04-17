import { useEffect, useMemo, useRef, useState } from "react";
import { allTerms, TERMS_LAST_UPDATED } from "../data/terms";

function Article({ article }) {
  return (
    <article className="scroll-mt-32">
      <header className="mb-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-bold tracking-wider text-amber-600 dark:text-amber-400">
            {article.num}
          </span>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white [word-break:keep-all]">
            {article.title}
          </h3>
        </div>
      </header>

      <div className="space-y-3 text-[14px] sm:text-[15px] leading-[1.75] text-gray-700 dark:text-gray-300">
        {article.intro && (
          <p className="text-gray-800 dark:text-gray-200 font-medium [word-break:keep-all]">
            {article.intro}
          </p>
        )}

        {article.paragraphs?.map((p, i) => (
          <p key={`p-${i}`} className="[word-break:keep-all]">
            {p}
          </p>
        ))}

        {article.subtitle && (
          <p className="text-gray-800 dark:text-gray-200 font-semibold pt-1 [word-break:keep-all]">
            {article.subtitle}
          </p>
        )}

        {article.list && article.list.length > 0 && (
          <ol className="space-y-2.5 pl-0 list-none">
            {article.list.map((item, i) => (
              <li
                key={`li-${i}`}
                className="relative pl-6 [word-break:keep-all]"
              >
                <span className="absolute left-0 top-[0.45em] w-4 h-4 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-none">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        )}

        {article.subsections?.map((sub, i) => (
          <div
            key={`sub-${i}`}
            className="mt-4 pl-4 border-l-2 border-amber-100 dark:border-amber-900/40 space-y-2"
          >
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 [word-break:keep-all]">
              {sub.title}
            </h4>
            {sub.paragraphs?.map((p, j) => (
              <p key={`sp-${j}`} className="[word-break:keep-all]">
                {p}
              </p>
            ))}
            {sub.list && (
              <ul className="space-y-2 pl-0 list-none">
                {sub.list.map((it, j) => (
                  <li
                    key={`sl-${j}`}
                    className="relative pl-4 [word-break:keep-all]"
                  >
                    <span className="absolute left-0 top-[0.7em] w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500" />
                    {it}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function Terms({ section = "service", onSelectSection, onBack }) {
  const active =
    allTerms.find((t) => t.key === section) ?? allTerms[0];
  const scrollAreaRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // 탭 전환 시 상단으로 스크롤
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?terms=${active.key}`;
  }, [active.key]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silent fail
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-24">
      {/* Breadcrumb / Back */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          홈으로
        </button>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium">이용약관</span>
      </div>

      {/* Hero title */}
      <div className="mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 rounded-full px-3 py-1">
          <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 tracking-wide">
            애즈덕(ADSDUCK) 정책 문서
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight [word-break:keep-all]">
          애즈덕 이용약관
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
          최종 업데이트 {TERMS_LAST_UPDATED}
        </p>
      </div>

      {/* Tabs */}
      <div
        ref={scrollAreaRef}
        className="sticky top-[calc(var(--header-h,64px))] z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200/70 dark:border-gray-800/70"
      >
        <div
          className="flex gap-1 overflow-x-auto scrollbar-hide py-3"
          role="tablist"
          aria-label="이용약관 탭"
        >
          {allTerms.map((t) => {
            const isActive = t.key === active.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectSection?.(t.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border bg-transparent cursor-pointer ${
                  isActive
                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/60"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header summary */}
      <div className="mt-6 sm:mt-8 mb-6 p-4 sm:p-5 bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 [word-break:keep-all]">
          {active.title}
        </h2>
        <p className="text-[13px] sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed [word-break:keep-all]">
          {active.summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyLink}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-transparent cursor-pointer ${
              copied
                ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-700"
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                링크 복사됨
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                이 약관 링크 복사
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-10">
        {active.chapters.map((chapter, ci) => (
          <section key={`ch-${ci}`} className="scroll-mt-32">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white mb-5 pb-2 border-b-2 border-amber-400/70 dark:border-amber-500/60 inline-block [word-break:keep-all]">
              {chapter.title}
            </h2>
            <div className="space-y-8">
              {chapter.articles.map((article, ai) => (
                <Article key={`ar-${ci}-${ai}`} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-14 p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed [word-break:keep-all]">
          본 약관은 애즈덕(ADSDUCK) 서비스 이용을 위한 공식 정책 문서입니다. 본 약관에
          명시되지 않은 사항에 대해서는 대한민국의 관계 법령과 상관습에 따릅니다. 문의는{" "}
          <a
            href="mailto:support@adsduck.kr"
            className="text-amber-600 dark:text-amber-400 font-semibold no-underline hover:underline"
          >
            support@adsduck.kr
          </a>
          로 연락해 주세요.
        </p>
      </div>
    </section>
  );
}

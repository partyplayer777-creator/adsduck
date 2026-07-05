import logoSrc from "../assets/adsduck-logo.png";
import logoWhiteSrc from "../assets/adsduck-logo-white.png";

export default function Footer({ onNavigate, onScrollToContests, darkMode }) {
  const handleContestList = () => {
    onScrollToContests?.();
  };

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <button
              onClick={() => onNavigate?.("home")}
              className="flex items-center mb-4 bg-transparent border-none cursor-pointer p-0 hover:opacity-80 transition-opacity"
            >
              <img
                src={darkMode ? logoWhiteSrc : logoSrc}
                alt="AdsDuck"
                className="h-8 w-auto"
              />
            </button>
            <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed max-w-xs">
              공모전 주최자와 크리에이터를 연결하는 홍보 공모전 플랫폼. 홍보하고 수익을 만드세요.
            </p>
          </div>

          {/* Service */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm tracking-wide uppercase">
              서비스
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <button
                  onClick={handleContestList}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal"
                >
                  공모전 목록
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("organizer")}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal"
                >
                  공모전 주최하기
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("board")}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal"
                >
                  게시판
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("lectures")}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal"
                >
                  AI강의레터
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("messages")}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal"
                >
                  쪽지함
                </button>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300 dark:text-gray-600">참여 가이드</span>
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded font-medium">준비중</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300 dark:text-gray-600">자주 묻는 질문</span>
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded font-medium">준비중</span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm tracking-wide uppercase">
              문의
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="mailto:support@adsduck.kr"
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors no-underline text-gray-400 dark:text-gray-500"
                >
                  support@adsduck.kr
                </a>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("terms", { section: "service" })}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal text-left"
                >
                  서비스 이용약관
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("terms", { section: "ad" })}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal text-left"
                >
                  광고 서비스 이용약관
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("terms", { section: "contest" })}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal text-left"
                >
                  콘테스트 이용약관
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("terms", { section: "points" })}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal text-left"
                >
                  포인트 운영정책
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.("terms", { section: "lectures" })}
                  className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm text-gray-400 dark:text-gray-500 font-normal text-left"
                >
                  AI강의레터 정책
                </button>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300 dark:text-gray-600">개인정보처리방침</span>
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded font-medium">준비중</span>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm tracking-wide uppercase">
              SNS
            </h3>
            <div className="flex gap-3">
              {[
                { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
                { label: "YouTube", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
                { label: "Twitter", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
              ].map((social) => (
                <div key={social.label} className="relative group/social">
                  <button
                    className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 cursor-not-allowed transition-all border-none opacity-60"
                    aria-label={`${social.label} (준비중)`}
                    disabled
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d={social.path} />
                    </svg>
                  </button>
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-gray-800 dark:bg-gray-700 text-white px-2 py-0.5 rounded-md whitespace-nowrap opacity-0 group-hover/social:opacity-100 transition-opacity pointer-events-none">
                    준비중
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 mt-10 pt-6 space-y-5">
          <div className="max-w-3xl space-y-1.5 text-xs leading-relaxed text-gray-400 dark:text-gray-600">
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="font-medium text-gray-500 dark:text-gray-500">사업자등록번호</span>{" "}
                837-21-02410
              </span>
              <span>
                <span className="font-medium text-gray-500 dark:text-gray-500">대표</span>{" "}
                김태엽
              </span>
              <span>
                <span className="font-medium text-gray-500 dark:text-gray-500">전화</span>{" "}
                010-8129-2242
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-500">주소</span>{" "}
              부산광역시 부전로 21-2 디엔디파인빌 402호
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-300 dark:text-gray-600">
              &copy; 2026 AdsDuck. All rights reserved.
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-700">
              Made with care for creators
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

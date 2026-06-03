import { useMemo, useState } from "react";
import { STORAGE_KEYS, getStoredItem } from "../storageKeys";

function readMessages() {
  try {
    return JSON.parse(getStoredItem(localStorage, STORAGE_KEYS.userMessages) || "[]");
  } catch {
    return [];
  }
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function MessageIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}

export default function Messages({ authSession, onRequireLogin }) {
  const [activeTab, setActiveTab] = useState("received");
  const [messages] = useState(readMessages);
  const user = authSession?.user || null;
  const userId = user?.id || null;

  const inbox = useMemo(() => messages
    .filter((message) => message.toId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [messages, userId]);

  const sent = useMemo(() => messages
    .filter((message) => message.fromId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [messages, userId]);

  const currentMessages = activeTab === "received" ? inbox : sent;

  return (
    <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">Messages</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">쪽지함</h1>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            게시판에서 주고받은 DM을 받은 쪽지와 보낸 쪽지로 나눠 확인합니다.
          </p>
        </div>
      </div>

      {!userId ? (
        <div className="rounded-md border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
          <MessageIcon className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-bold text-gray-700 dark:text-gray-200">로그인 후 쪽지함을 볼 수 있습니다.</p>
          <button
            onClick={() => onRequireLogin?.("login")}
            className="mt-4 h-9 rounded-md border-none bg-gray-950 px-4 text-xs font-bold text-white dark:bg-white dark:text-gray-950"
          >
            로그인
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex border-b border-gray-100 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950">
            {[
              { key: "received", label: "받은 쪽지", count: inbox.length },
              { key: "sent", label: "보낸 쪽지", count: sent.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`h-9 flex-1 rounded-md border-none text-sm font-bold transition ${
                  activeTab === tab.key
                    ? "bg-white text-gray-950 shadow-sm dark:bg-gray-900 dark:text-white"
                    : "bg-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
                <span className="ml-1 text-xs opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          {currentMessages.length === 0 ? (
            <div className="p-8 text-center">
              <MessageIcon className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">
                {activeTab === "received" ? "받은 쪽지가 없습니다." : "보낸 쪽지가 없습니다."}
              </p>
            </div>
          ) : (
            <div>
              {currentMessages.map((message) => (
                <article key={message.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        {activeTab === "received" ? `보낸 사람: ${message.fromName}` : `받는 사람: ${message.toName}`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-200">
                        {message.content}
                      </p>
                    </div>
                    <time className="flex-shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                      {formatDate(message.createdAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

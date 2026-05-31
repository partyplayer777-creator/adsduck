import { useState, useEffect } from "react";

function ToastItem({ message, type, onDone }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const exit = setTimeout(() => setLeaving(true), 2500);
    const done = setTimeout(() => onDone(), 2850);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(exit);
      clearTimeout(done);
    };
  }, [onDone]);

  const iconColors = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-amber-500",
  };

  const bgColors = {
    success: "bg-gray-900 dark:bg-gray-800",
    error: "bg-red-900",
    info: "bg-gray-900 dark:bg-gray-800",
  };

  return (
    <div
      className={`flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl shadow-2xl shadow-black/20 min-w-[180px] max-w-[300px] transition-all duration-300 ease-out ${
        visible && !leaving
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95"
      } ${bgColors[type] ?? bgColors.success} text-white`}
    >
      {/* Icon */}
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors[type] ?? iconColors.success}`}>
        {type === "success" && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {type === "error" && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {type === "info" && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {/* Message */}
      <p className="text-sm font-semibold leading-tight">{message}</p>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-32 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[200] flex flex-col gap-2 items-center sm:items-end pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            message={toast.message}
            type={toast.type}
            onDone={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

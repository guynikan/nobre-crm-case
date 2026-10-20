"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "error" | "success" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string | undefined;
}

const ToastContext = createContext<((toast: Omit<Toast, "id">) => void) | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  error: "border-danger-600 bg-danger-100 text-danger-600",
  success: "border-nobre-500 bg-nobre-100 text-nobre-900",
  info: "border-line bg-panel text-ink",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 6_000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-md border-l-4 px-4 py-3 shadow-lg ${TONE_CLASSES[toast.tone]}`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.detail ? <p className="mt-0.5 text-sm opacity-90">{toast.detail}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside ToastProvider");
  return useMemo(
    () => ({
      error: (title: string, detail?: string) => push({ tone: "error", title, detail }),
      success: (title: string, detail?: string) => push({ tone: "success", title, detail }),
      info: (title: string, detail?: string) => push({ tone: "info", title, detail }),
    }),
    [push],
  );
}

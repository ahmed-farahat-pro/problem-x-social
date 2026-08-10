"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  message: string;
  tone: "ok" | "error";
}

const ToastContext = createContext<(message: string, tone?: "ok" | "error") => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "animate-toast pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-2xl shadow-black/40 backdrop-blur",
              toast.tone === "error"
                ? "border-rose-500/30 bg-rose-500/15 text-rose-200"
                : "border-[var(--line-strong)] bg-[var(--surface-overlay)]/95 text-body",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

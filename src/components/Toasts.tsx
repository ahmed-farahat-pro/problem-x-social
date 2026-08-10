"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function Toasts() {
  const { toasts } = useStore();
  if (!toasts.length) return null;

  return (
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
  );
}

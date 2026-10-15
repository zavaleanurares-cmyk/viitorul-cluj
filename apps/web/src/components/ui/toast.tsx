"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastOptions = {
  /** acțiune de anulare pentru ștergeri și modificări în masă; ținem mesajul mai mult pe ecran */
  undo?: () => void | Promise<unknown>;
  undoLabel?: string;
};
type Toast = { id: number; message: string; tone: "ok" | "error" } & ToastOptions;
type Push = (message: string, tone?: Toast["tone"], options?: ToastOptions) => void;
const ToastContext = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>((message, tone = "ok", options = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone, ...options }]);
    setTimeout(() => dismiss(id), options.undo ? 8000 : tone === "error" ? 6000 : 2800);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
            className={cn("pointer-events-auto flex max-w-md items-center gap-2 rounded-full py-2 pl-4 text-[0.9375rem] font-medium shadow-[var(--shadow-float)] backdrop-blur-xl",
              t.undo ? "pr-2" : "pr-5",
              t.tone === "error" ? "bg-st-red text-white" : "bg-ink/90 text-white")}>
            {t.tone === "error" ? <TriangleAlert className="size-5 shrink-0" aria-hidden /> : <Check className="size-5 shrink-0" aria-hidden />}
            <span className="py-1">{t.message}</span>
            {t.undo ? (
              <>
                <button type="button" className="ml-2 h-9 rounded-lg px-3 font-bold underline hover:bg-white/10"
                  onClick={async () => { dismiss(t.id); await t.undo?.(); }}>
                  {t.undoLabel ?? "Anulează"}
                </button>
                <button type="button" aria-label="Închide mesajul" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/10"
                  onClick={() => dismiss(t.id)}>
                  <X className="size-5" aria-hidden />
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * `const toast = useToast(); toast("Salvat."); toast("Eroare…", "error");`
 * Cu anulare: `toast("Eveniment șters.", "ok", { undo: () => restore.run(id) })`.
 */
export function useToast() {
  return useContext(ToastContext);
}

"use client";
import { useEffect, type ReactNode } from "react";

/** Bara de salvare, lipită de marginea de jos (deasupra meniului pe telefon). */
export function SaveBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-16 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:mx-0 md:rounded-[var(--radius-card)] md:border">
      {children}
      {note ? <span className="text-sm font-semibold text-ink-2" aria-live="polite">{note}</span> : null}
    </div>
  );
}

/** Întreabă înainte de părăsirea paginii dacă există modificări nesalvate. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

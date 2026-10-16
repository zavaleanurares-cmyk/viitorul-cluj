"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fereastră modală pe <dialog> nativ: pe telefon urcă de jos (foaie), pe ecrane mari este centrată.
 * Se închide cu Esc, cu butonul X sau atingând fundalul.
 */
export function Dialog({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[var(--radius-sheet)] bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-black/30 backdrop:backdrop-blur-[2px]",
        "md:m-auto md:rounded-[var(--radius-sheet)]", wide ? "md:max-w-3xl" : "md:max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-3 py-3 pl-5 pr-3">
            <h2 className="text-[1.0625rem]">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Închide" className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2 transition-colors hover:bg-line">
              <X className="size-4" strokeWidth={2.5} aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          {/* ștergerea stă separat: în stânga pe ecran lat, pe un rând al ei, jos, pe telefon */}
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] [&>*:has(.lucide-trash-2)]:text-st-red max-sm:[&>*:has(.lucide-trash-2)]:order-last max-sm:[&>*:has(.lucide-trash-2)]:basis-full sm:[&>*:has(.lucide-trash-2)]:mr-auto">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

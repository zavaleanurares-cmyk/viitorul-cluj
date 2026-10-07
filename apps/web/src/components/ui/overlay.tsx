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
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/50",
        "md:m-auto md:rounded-2xl", wide ? "md:max-w-3xl" : "md:max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line py-2 pl-4 pr-2">
            <h2 className="text-lg">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Închide" className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-sunken">
              <X className="size-6" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto p-4">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-4 pb-safe">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

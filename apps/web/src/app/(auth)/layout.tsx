import { APP_NAME } from "@/lib/env";
import { getT } from "@/messages";
import { ClearOfflinePages } from "@/components/auth/clear-offline-pages";

/** Cadru comun pentru paginile de dinainte de autentificare. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = getT().common;
  return (
    // o singură coloană centrată, ca ecranele de conectare Apple: semnul aplicației, numele, apoi formularul într-un card
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 pb-10 pt-[calc(3rem+env(safe-area-inset-top,0px))] md:justify-center md:py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <span aria-hidden className="mb-4 inline-flex size-16 items-center justify-center rounded-[1.125rem] bg-brand text-brand-ink shadow-[var(--shadow-card)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l2.5-6 4 12 2.5-6h7" />
          </svg>
        </span>
        <p className="text-[1.75rem] font-semibold tracking-tight">{APP_NAME}</p>
        <p className="mt-1 max-w-xs text-[0.9375rem] text-ink-3">{t.appTagline}</p>
      </div>
      <div className="w-full max-w-md rounded-[var(--radius-sheet)] bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">{children}</div>
      <ClearOfflinePages />
    </main>
  );
}

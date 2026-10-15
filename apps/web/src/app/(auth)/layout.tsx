import { APP_NAME } from "@/lib/env";
import { getT } from "@/messages";
import { ClearOfflinePages } from "@/components/auth/clear-offline-pages";

/** Cadru comun pentru paginile de dinainte de autentificare. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = getT().common;
  return (
    <main className="flex min-h-dvh flex-col bg-surface md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col justify-end bg-brand px-6 pb-6 pt-10 text-brand-ink pt-safe md:justify-center md:p-12">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mb-4 md:mb-6 md:size-20">
          <path d="M2 12h4l2.5-6 4 12 2.5-6h7" />
        </svg>
        <p className="text-4xl font-bold md:text-6xl">{APP_NAME}</p>
        <p className="mt-2 max-w-xs text-lg opacity-90 md:text-xl">{t.appTagline}</p>
      </div>
      <div className="flex flex-1 items-start justify-center p-6 md:items-center md:p-12">
        <div className="w-full max-w-sm">{children}</div>
        <ClearOfflinePages />
      </div>
    </main>
  );
}

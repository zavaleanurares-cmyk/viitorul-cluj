import { WifiOff } from "lucide-react";

export const metadata = { title: "Fără conexiune" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
      <WifiOff className="size-12 text-ink-3" aria-hidden />
      <h1 className="text-2xl">Fără conexiune la internet</h1>
      <p className="max-w-sm text-ink-3">Aplicația are nevoie de internet ca să încarce datele. Verifică conexiunea și încearcă din nou.</p>
      {/* reîncărcare completă, intenționat fără <Link> */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-2 inline-flex h-12 items-center rounded-lg bg-brand px-5 font-semibold text-brand-ink">
        Încearcă din nou
      </a>
    </main>
  );
}

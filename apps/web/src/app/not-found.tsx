import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
      <h1 className="text-3xl">Pagina nu există</h1>
      <p className="max-w-sm text-ink-3">Fie adresa este greșită, fie nu ai acces la această pagină.</p>
      <Link href="/" className="mt-2 inline-flex h-12 items-center rounded-lg bg-brand px-5 font-semibold text-brand-ink">
        Mergi la pagina de start
      </Link>
    </main>
  );
}

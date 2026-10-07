import { getT } from "@/messages";
import { APP_NAME } from "@/lib/env";
import { LinkForm } from "./form";

export const metadata = { title: "Activare cont" };

/**
 * Destinația linkurilor de invitație și de resetare a parolei: /auth/link?t=<token>.
 * Linkul NU se consumă la deschiderea paginii (scanerele de e-mail deschid linkurile automat),
 * ci doar când utilizatorul apasă butonul.
 */
export default async function LinkPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t: token } = await searchParams;
  const t = getT().auth.confirm;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
      <p className="text-lg font-bold text-ink-3">{APP_NAME}</p>
      <h1 className="text-3xl">{t.title}</h1>
      <p className="max-w-sm text-ink-3">{t.intro}</p>
      <LinkForm token={token ?? ""} />
    </main>
  );
}

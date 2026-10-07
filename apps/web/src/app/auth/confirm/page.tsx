"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/messages";

/**
 * Destinația linkurilor din e-mail (invitație, resetare de parolă). Acceptă toate cele trei forme
 * în care Supabase poate trimite utilizatorul înapoi:
 *   ?token_hash=…&type=…   (șablon de e-mail personalizat — recomandat, vezi README)
 *   ?code=…                 (flux PKCE)
 *   #access_token=…         (flux implicit, șablonul implicit de invitație)
 */
export default function ConfirmPage() {
  const t = useT().auth.confirm;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const db = createClient();
      const url = new URL(window.location.href);
      const nextRaw = url.searchParams.get("next");
      const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/parola?prima=1";
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      let ok = false;
      try {
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") as EmailOtpType | null;
        const code = url.searchParams.get("code");
        if (tokenHash && type) ok = !(await db.auth.verifyOtp({ token_hash: tokenHash, type })).error;
        else if (code) ok = !(await db.auth.exchangeCodeForSession(code)).error;
        else if (hash.get("access_token") && hash.get("refresh_token")) {
          ok = !(await db.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! })).error;
        } else ok = !!(await db.auth.getSession()).data.session;
      } catch {
        ok = false;
      }
      if (ok) window.location.replace(next);
      else setFailed(true);
    })();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
      {failed ? (
        <>
          <h1 className="text-2xl">{t.invalid}</h1>
          <Link href="/parola-uitata" className="inline-flex h-12 items-center rounded-lg bg-brand px-5 font-semibold text-brand-ink">
            Cere un link nou
          </Link>
        </>
      ) : (
        <>
          <span className="size-8 animate-spin rounded-full border-4 border-brand border-r-transparent" aria-hidden />
          <p className="text-lg">{t.working}</p>
        </>
      )}
    </main>
  );
}

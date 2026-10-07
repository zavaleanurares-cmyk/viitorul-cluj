import "server-only";
import { revalidatePath } from "next/cache";
import { DataError, friendlyError, type AppRole } from "@club/shared";
import { getSession, type Session } from "./auth";

export type ActionResult<T = void> = { ok: true; data: T; message?: string } | { ok: false; error: string };

type Options = {
  /** rolurile care au voie să apeleze acțiunea (verificare în plus față de RLS) */
  roles?: AppRole[];
  /** căi de reîmprospătat după succes */
  revalidate?: string[];
  /** mesaj de confirmare afișat utilizatorului */
  message?: string;
};

/**
 * Învelește o acțiune de server: verifică sesiunea și rolul, prinde erorile și le întoarce
 * ca mesaj în română. Baza de date rămâne ultima linie de apărare (RLS).
 *
 *   export async function saveThing(input: Input) {
 *     return run({ roles: ["physio"], revalidate: ["/jucatori"] }, async ({ db, ctx }) => { ... });
 *   }
 */
export async function run<T>(options: Options, fn: (session: Session) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sesiunea a expirat. Autentifică-te din nou." };
    if (options.roles && !options.roles.includes(session.ctx.role)) {
      return { ok: false, error: "Nu ai dreptul să faci această operațiune." };
    }
    const data = await fn(session);
    for (const p of options.revalidate ?? []) revalidatePath(p);
    return { ok: true, data, message: options.message };
  } catch (e) {
    // redirect() și notFound() trebuie lăsate să treacă
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    if (e instanceof DataError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "issues" in e) {
      const issue = (e as { issues: Array<{ message: string }> }).issues[0];
      return { ok: false, error: issue?.message ?? "Date invalide." };
    }
    const err = e as { message?: string; code?: string };
    console.error("[acțiune]", err?.message ?? e);
    return { ok: false, error: friendlyError(err) };
  }
}

/** Aruncă o eroare cu mesaj pentru utilizator. */
export function fail(message: string): never {
  throw new DataError(message);
}

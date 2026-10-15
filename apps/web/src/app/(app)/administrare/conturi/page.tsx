import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { AccountsList } from "@/components/admin/accounts-list";
import { loadAccounts } from "@/components/admin/queries";
import { getT } from "@/messages";

export const metadata = { title: "Conturi" };

/** Conturile clubului. Conturile se creează doar aici, de către preparator (nu există înregistrare publică). */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; rol?: string; stare?: string; jucator?: string }> }) {
  const { db, ctx } = await requireRole("physio", "admin");
  const sp = await searchParams;
  const t = getT().admin.accounts;
  const { accounts, withoutAccount } = await loadAccounts(db, ctx);

  // linkul din fișa jucătorului: deschide contul lui sau formularul de creare, cu jucătorul ales
  const playerId = typeof sp.jucator === "string" ? sp.jucator : undefined;
  const linked = playerId ? accounts.find((a) => a.player?.id === playerId) : undefined;
  const free = playerId ? withoutAccount.find((p) => p.id === playerId) : undefined;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <AccountsList
        accounts={accounts}
        groups={ctx.groups}
        withoutAccount={withoutAccount}
        openAccountId={linked?.id}
        newPlayerId={free?.id}
        initial={{
          q: typeof sp.q === "string" ? sp.q : "",
          rol: typeof sp.rol === "string" ? sp.rol : "",
          stare: typeof sp.stare === "string" ? sp.stare : "",
        }}
      />
    </>
  );
}

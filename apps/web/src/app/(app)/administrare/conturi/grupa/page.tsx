import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/misc";
import { BulkAccounts } from "@/components/admin/bulk-accounts";
import { loadAccounts } from "@/components/admin/queries";
import { getT } from "@/messages";

export const metadata = { title: "Conturi pentru o grupă" };

/** Creare în masă: jucătorii fără cont ai unei grupe, cu câte un câmp de e-mail. */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string }> }) {
  const { db, ctx } = await requireRole("physio", "admin");
  const sp = await searchParams;
  const t = getT().admin.bulk;
  const { withoutAccount } = await loadAccounts(db, ctx);
  const groups = ctx.groups.filter((g) => g.is_active && withoutAccount.some((p) => p.groupId === g.id));
  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0];
  const players = group ? withoutAccount.filter((p) => p.groupId === group.id) : [];

  return (
    <>
      <PageHeader
        title={t.title} description={t.description}
        back={<Link href="/administrare/conturi" className="underline underline-offset-4">{t.back}</Link>}
      />
      {!group ? (
        <EmptyState title={t.emptyTitle} description={t.empty} />
      ) : (
        <>
          <TabLinks
            className="mb-4" current={group.id}
            tabs={groups.map((g) => ({
              key: g.id, href: `/administrare/conturi/grupa?grupa=${g.id}`,
              label: `${g.name} (${withoutAccount.filter((p) => p.groupId === g.id).length})`,
            }))}
          />
          <BulkAccounts key={group.id} players={players} groupName={group.name} />
        </>
      )}
    </>
  );
}

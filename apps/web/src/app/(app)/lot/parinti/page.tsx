import Link from "next/link";
import { Phone, Search } from "lucide-react";
import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { GuardianDialogButton } from "@/components/squad/guardian-dialog";
import { listGuardians } from "@/components/squad/queries";
import { getT } from "@/messages";

export const metadata = { title: "Părinți" };

export default async function GuardiansPage({ searchParams }: { searchParams: Promise<{ q?: string; copil?: string }> }) {
  const { db, ctx } = await requireCapability("viewSquad");
  const sp = await searchParams;
  const t = getT().squad.guardians;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const canManage = can(ctx.role, "manageSquad");
  const [guardians, players] = await Promise.all([
    listGuardians(db, q),
    canManage ? db.from("players").select("id, full_name, group_id").eq("is_active", true).is("anonymized_at", null).order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const teamName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const options = (players.data ?? []).map((p) => ({ id: p.id, name: p.full_name, team: p.group_id ? teamName.get(p.group_id) ?? null : null }));
  const presetChild = typeof sp.copil === "string" && options.some((o) => o.id === sp.copil) ? sp.copil : undefined;

  return (
    <>
      <PageHeader title={t.title} action={canManage ? <GuardianDialogButton players={options} autoOpen={!!presetChild} presetChild={presetChild} /> : null} />
      <form action="/lot/parinti" method="get" role="search" className="mb-4 flex max-w-md gap-2">
        <label className="sr-only" htmlFor="g-q">{t.search}</label>
        <input id="g-q" name="q" defaultValue={q} placeholder={t.search}
          className="h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border-control bg-surface px-3" />
        <button type="submit" aria-label={t.search} className="inline-flex size-12 items-center justify-center rounded-[var(--radius-control)] border border-border-control bg-surface hover:bg-canvas">
          <Search className="size-5" aria-hidden />
        </button>
      </form>

      {guardians.length === 0 ? <EmptyState title={t.emptyTitle} description={t.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {guardians.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{g.full_name} {g.user_id ? <Badge tone="green" className="ml-1">{t.hasAccount}</Badge> : null}</p>
                <p className="text-sm text-ink-2">
                  {g.guardian_players.length === 0 ? <span className="text-ink-3">{t.noChildren}</span> : g.guardian_players.map((gp, i) => (
                    <span key={gp.player_id}>
                      {i ? ", " : ""}
                      <Link href={`/lot/jucatori/${gp.player_id}`} className="hover:underline">{gp.players?.full_name}</Link>
                      <span className="text-ink-3"> ({t.relations[gp.relation] ?? gp.relation})</span>
                    </span>
                  ))}
                </p>
                {g.email ? <p className="text-sm text-ink-3">{g.email}</p> : null}
              </div>
              {g.phone ? (
                <a href={`tel:${g.phone.replace(/\s+/g, "")}`} aria-label={t.phoneLink(g.phone)}
                  className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border-control px-3 font-semibold hover:bg-canvas">
                  <Phone className="size-4" aria-hidden /> {g.phone}
                </a>
              ) : null}
              {canManage ? (
                <GuardianDialogButton players={options} hasAccount={!!g.user_id} guardian={{
                  id: g.id, fullName: g.full_name, phone: g.phone ?? "", email: g.email ?? "", notes: g.notes ?? "",
                  children: g.guardian_players.map((gp) => ({ playerId: gp.player_id, relation: gp.relation as "parent", isBilling: gp.is_billing })),
                }} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

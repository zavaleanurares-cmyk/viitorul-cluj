import Link from "next/link";
import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { TeamDialogButton } from "@/components/squad/team-dialog";
import { listTeamsWithCoaches } from "@/components/squad/queries";
import { getT } from "@/messages";

export const metadata = { title: "Echipe" };

export default async function TeamsPage() {
  const { db, ctx } = await requireCapability("viewSquad");
  const t = getT().squad.teams;
  const canManage = can(ctx.role, "manageSquad");
  const all = await listTeamsWithCoaches(db, ctx.club.id);
  const teams = ctx.role === "coach" ? all.filter((g) => ctx.staffGroupIds.includes(g.id)) : all;

  return (
    <>
      <PageHeader title={t.title} action={canManage ? <TeamDialogButton /> : null} />
      {teams.length === 0 ? <EmptyState title={t.emptyTitle} description={t.emptyText} /> : (
        <TableWrap>
          <>
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-ink-3">
                <th scope="col" className="px-3 py-2.5">{t.columns.team}</th>
                <th scope="col" className="px-3 py-2.5">{t.columns.years}</th>
                <th scope="col" className="px-3 py-2.5">{t.columns.format}</th>
                <th scope="col" className="px-3 py-2.5 text-right">{t.columns.players}</th>
                <th scope="col" className="px-3 py-2.5">{t.columns.coaches}</th>
                {canManage ? <th scope="col" className="px-3 py-2.5"><span className="sr-only">{t.edit}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {teams.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/lot?echipa=${g.id}`} className="flex items-center gap-2 text-base font-semibold hover:underline">
                      <span aria-hidden className="size-3 shrink-0 rounded-full border border-line-strong" style={{ background: g.color ?? "transparent" }} />
                      {g.name}
                    </Link>
                    {g.programme ? <span className="ml-5 text-ink-3">{g.programme}</span> : null}
                    {!g.is_active ? <span className="ml-2 text-ink-3">· {t.inactive}</span> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{g.birth_year_from ? (g.birth_year_to && g.birth_year_to !== g.birth_year_from ? `${g.birth_year_from}–${g.birth_year_to}` : g.birth_year_from) : "—"}</td>
                  <td className="px-3 py-2">{t.format(g.players_on_pitch, g.half_minutes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.players}</td>
                  <td className="px-3 py-2">{g.coaches.length ? g.coaches.join(", ") : <span className="text-ink-3">{t.noCoach}</span>}</td>
                  {canManage ? (
                    <td className="px-3 py-1 text-right">
                      <TeamDialogButton team={{
                        id: g.id, name: g.name, programme: g.programme ?? "", yearFrom: g.birth_year_from ?? "", yearTo: g.birth_year_to ?? "",
                        gender: (g.gender as "m" | "f" | "mixed" | null) ?? "", playersOnPitch: g.players_on_pitch ?? "", halfMinutes: g.half_minutes ?? "", color: g.color ?? "",
                      }} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </>
        </TableWrap>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { listPlayers } from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { getSessionDetail } from "@/components/physical/queries";
import { SessionEditor } from "@/components/physical/session-editor";

/** Modificarea unei sesiuni și a valorilor ei (doar preparatorul). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireRole("physio");
  const detail = await getSessionDetail(db, id);
  if (!detail) notFound();
  const t = getT().physical;
  const { session, rows } = detail;
  const active = await listPlayers(db);
  const known = new Set(active.map((p) => p.id));
  // jucătorii activi + cei care au valori în sesiune, chiar dacă între timp au fost dezactivați
  const players = [
    ...active.map((p) => ({ id: p.id, name: p.display_name, group_id: p.group_id })),
    ...rows.filter((r) => !known.has(r.player_id)).map((r) => ({ id: r.player_id, name: r.name, group_id: r.group_id })),
  ].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  const backHref = `/fizic/sesiuni/${session.id}`;

  return (
    <>
      <PageHeader
        back={
          <Link href={backHref} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-5" aria-hidden /> {t.editor.backToSession}
          </Link>
        }
        title={t.editor.titleEdit}
        description={t.editor.descriptionEdit}
      />
      <SessionEditor
        session={session}
        groups={visibleGroups(ctx).map((g) => ({ id: g.id, name: g.name }))}
        defaultGroupId={session.group_id}
        players={players}
        existing={Object.fromEntries(rows.map((r) => [r.player_id, r.values]))}
        today={ctx.today}
        backHref={backHref}
      />
    </>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listPlayers } from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { SessionEditor } from "@/components/physical/session-editor";

/** Sesiune introdusă manual (doar preparatorul). */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const sp = await searchParams;
  const t = getT().physical;
  const groups = visibleGroups(ctx);
  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0] ?? null;
  const players = await listPlayers(db);
  const backHref = group && group.id !== groups[0]?.id ? `/fizic?grupa=${group.id}` : "/fizic";

  return (
    <>
      <PageHeader
        back={
          <Link href={backHref} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-5" aria-hidden /> {t.session.back}
          </Link>
        }
        title={t.editor.titleNew}
        description={t.editor.descriptionNew}
      />
      <SessionEditor
        session={null}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        defaultGroupId={group?.id ?? null}
        players={players.map((p) => ({ id: p.id, name: p.display_name, group_id: p.group_id }))}
        existing={{}}
        today={ctx.today}
        backHref={backHref}
      />
    </>
  );
}

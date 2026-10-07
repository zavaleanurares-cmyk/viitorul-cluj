import { notFound, redirect } from "next/navigation";
import { can, formatDateShort } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { getT } from "@/messages";
import { DocumentsPanel, type DocumentItem } from "@/components/players/documents-panel";
import { dayOf, injuryZoneText } from "@/components/players/domain";
import { getPlayerForRequest, listDocuments, listInjuries, profileNames } from "@/components/players/queries";

/** Documentele medicale ale jucătorului: RMN-uri, ecografii, scrisori medicale, acorduri semnate. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  if (!can(ctx.role, "viewMedicalFile")) redirect(`/jucatori/${id}`);
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  await db.rpc("log_medical_access", { p_player: id, p_section: "documente" });

  const t = getT().players.docs;
  const canManage = can(ctx.role, "manage");
  const [docs, injuries] = await Promise.all([listDocuments(db, id), listInjuries(db, id)]);
  const names = await profileNames(db, docs.map((d) => d.uploaded_by));
  const injuryLabel = new Map(
    injuries.map((i) => [i.id, t.injuryOption(formatDateShort(i.occurred_on), injuryZoneText(i, true))]),
  );

  const items: DocumentItem[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    injury: d.injury_id ? injuryLabel.get(d.injury_id) ?? null : null,
    uploadedBy: d.uploaded_by === ctx.userId ? t.byYou : d.uploaded_by ? names[d.uploaded_by] ?? null : null,
    date: formatDateShort(dayOf(d.created_at, ctx.settings.timezone)),
    size: d.size_bytes,
    openUrl: fileUrl("medical", d.storage_path)!,
    downloadUrl: fileUrl("medical", d.storage_path, { download: true })!,
    canDelete: canManage,
  }));

  return (
    <DocumentsPanel
      title={t.title}
      description={t.description}
      docs={items}
      upload={canManage ? { mode: "player", playerId: id, injuries: injuries.map((i) => ({ id: i.id, label: injuryLabel.get(i.id)! })) } : null}
      emptyTitle={t.emptyTitle}
      emptyDescription={canManage ? t.emptyPhysio : t.emptyCoach}
    />
  );
}

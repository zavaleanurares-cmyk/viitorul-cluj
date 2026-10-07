import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FEET, POSITIONS, ageOn, formatDate, formatDateShort, formatDateTime, label } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Avatar, DataList } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { getT } from "@/messages";
import { CaseNotes } from "@/components/players/case-notes";
import { DocumentsPanel, type DocumentItem } from "@/components/players/documents-panel";
import { dayOf, injuryIsActive, injuryZoneText } from "@/components/players/domain";
import { InjuryFacts } from "@/components/players/injury-view";
import { getMyCase, listCaseNotes, listDocuments, listInjuries } from "@/components/players/queries";

/** Un caz al partenerului medical: datele de bază, accidentarea trimisă, documente și note. RLS decide ce se vede. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("partnerCases");
  const referral = await getMyCase(db, ctx.userId, id);
  if (!referral) notFound();
  const player = referral.players!;
  await db.rpc("log_medical_access", { p_player: player.id, p_section: "medical" });

  const t = getT().partner;
  const m = getT().players.medical;
  const d = getT().players.docs;
  const tz = ctx.settings.timezone;
  const [allInjuries, docs, notes] = await Promise.all([
    listInjuries(db, player.id),
    listDocuments(db, player.id),
    listCaseNotes(db, referral.id),
  ]);
  // RLS întoarce accidentările tuturor trimiterilor active ale partenerului pentru acest jucător;
  // pe pagina unui caz arătăm doar ce ține de trimiterea lui
  const injuries = referral.injury_id ? allInjuries.filter((i) => i.id === referral.injury_id) : allInjuries;
  const injuryById = new Map(allInjuries.map((i) => [i.id, i]));
  const caseDocs = referral.injury_id
    ? docs.filter((x) => x.injury_id === referral.injury_id || x.uploaded_by === ctx.userId)
    : docs;

  const age = ageOn(player.birth_date, ctx.today);
  const group = ctx.groups.find((g) => g.id === player.group_id);

  const items: DocumentItem[] = caseDocs.map((x) => {
    const inj = x.injury_id ? injuryById.get(x.injury_id) : null;
    return {
      id: x.id,
      title: x.title,
      kind: x.kind,
      injury: inj ? d.injuryOption(formatDateShort(inj.occurred_on), injuryZoneText(inj, true)) : null,
      uploadedBy: x.uploaded_by === ctx.userId ? d.byYou : d.byClub,
      date: formatDateShort(dayOf(x.created_at, tz)),
      size: x.size_bytes,
      openUrl: fileUrl("medical", x.storage_path)!,
      downloadUrl: fileUrl("medical", x.storage_path, { download: true })!,
      canDelete: x.uploaded_by === ctx.userId,
    };
  });

  return (
    <>
      <Link href="/cazuri" className="mb-2 inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> {t.back}
      </Link>
      <header className="mb-4 flex items-center gap-3">
        <Avatar name={player.display_name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl md:text-3xl">{player.display_name}</h1>
          <p className="truncate text-ink-3">{t.sentOn(formatDate(dayOf(referral.created_at, tz)))}</p>
        </div>
      </header>

      <div className="space-y-4">
        <Notice tone="blue" title={t.reason}>{referral.reason || t.noReason}</Notice>

        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <Card>
            <CardHeader title={t.playerTitle} />
            <CardBody>
              <DataList
                items={[
                  { label: t.fullName, value: player.full_name },
                  { label: t.birthDate, value: player.birth_date ? `${formatDate(player.birth_date)}${age !== null ? ` (${t.age(age)})` : ""}` : "—" },
                  { label: t.group, value: group?.name ?? "—" },
                  { label: t.position, value: label(POSITIONS, player.position) },
                  { label: t.foot, value: label(FEET, player.dominant_foot) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.injuriesTitle} description={referral.injury_id ? t.injuriesScopeOne : t.injuriesScopeAll} />
            <CardBody>
              {!injuries.length ? (
                <p className="text-ink-3">{t.injuriesEmpty}</p>
              ) : (
                <ul className="space-y-5">
                  {injuries.map((injury) => (
                    <li key={injury.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                      <h3 className="text-[1.0625rem] leading-snug">{injuryZoneText(injury) || m.zoneUnknown}</h3>
                      <p className="mb-3 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                        <Badge tone={injuryIsActive(injury) ? "red" : "gray"}>{injuryIsActive(injury) ? m.active : m.closed}</Badge>
                        <span>{formatDate(injury.occurred_on)}</span>
                      </p>
                      <InjuryFacts injury={injury} previous={injury.recurrence_of ? injuryById.get(injury.recurrence_of) : null} today={ctx.today} />
                      {injury.injury_treatments.length ? (
                        <div className="mt-3">
                          <h4 className="mb-1 text-sm font-semibold text-ink-3">{m.showTreatments(injury.injury_treatments.length)}</h4>
                          <ul className="divide-y divide-line border-y border-line">
                            {injury.injury_treatments.map((tr) => (
                              <li key={tr.id} className="flex gap-2 py-1.5">
                                <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-ink-3">{formatDateShort(tr.treated_on, false)}</span>
                                <span className="min-w-0 flex-1 whitespace-pre-line">{tr.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <DocumentsPanel
          title={t.docsTitle}
          description={t.docsDescription}
          docs={items}
          upload={{ mode: "case", playerId: player.id, referralId: referral.id }}
          emptyTitle={t.docsEmpty}
          emptyDescription={t.docsEmptyHint}
        />

        <CaseNotes
          referralId={referral.id}
          notes={notes.map((n) => ({ id: n.id, note: n.note, when: formatDateTime(n.created_at, tz), mine: n.author_id === ctx.userId }))}
        />
      </div>
    </>
  );
}

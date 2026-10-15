import Link from "next/link";
import { can, formatDate, formatDateShort } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { TabLinks, TableWrap } from "@/components/ui/misc";
import { NavSelect } from "@/components/planning/nav-select";
import { VisaChip } from "@/components/squad/bits";
import { visaState } from "@/components/squad/queries";
import { VisaDecision, VisaRemindButton, VisaUploadButton } from "@/components/performance/visa";
import { getT } from "@/messages";

export const metadata = { title: "Vize medicale" };

type Doc = { id: string; player_id: string; storage_path: string; issued_on: string | null; status: string; reject_reason: string | null; uploaded_at: string; uploaded_by: string | null; valid_until: string | null };

/**
 * Vizele medicale ale lotului. Întâi ce trebuie făcut (documente de aprobat, vize expirate sau lipsă,
 * vize care expiră curând), apoi tabelul complet. Antrenorul vede doar echipele lui (RLS).
 */
export default async function VisasPage({ searchParams }: { searchParams: Promise<{ vedere?: string; echipa?: string }> }) {
  const { db, ctx } = await requireCapability("viewVisas");
  const sp = await searchParams;
  const t = getT().performance.visas;
  const view = sp.vedere === "toti" ? "all" : "todo";
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? null;
  const manage = can(ctx.role, "manageVisas");
  const warnDays = ctx.settings.alerts.visa_days_before;
  const months = ctx.settings.medical_visa_validity_months ?? 12;

  let q = db.from("players").select("id, display_name, full_name, group_id, medical_visa_expires_on")
    .eq("is_active", true).is("anonymized_at", null).order("display_name");
  if (team) q = q.eq("group_id", team.id);
  else if (ctx.role === "coach") q = q.in("group_id", teams.map((g) => g.id));
  const [{ data: players }, { data: docs }] = await Promise.all([
    q,
    db.from("visa_documents").select("id, player_id, storage_path, issued_on, status, reject_reason, uploaded_at, uploaded_by, valid_until").order("uploaded_at", { ascending: false }).limit(2000),
  ]);
  const roster = players ?? [];
  const inRoster = new Set(roster.map((p) => p.id));
  const latest = new Map<string, Doc>();
  for (const d of (docs ?? []) as Doc[]) if (!latest.has(d.player_id)) latest.set(d.player_id, d);
  const pending = ((docs ?? []) as Doc[]).filter((d) => d.status === "pending" && inRoster.has(d.player_id));
  const uploaderIds = [...new Set(pending.map((d) => d.uploaded_by).filter(Boolean))] as string[];
  // părinții se văd în lista de părinți a clubului; staff-ul în profiluri
  const [{ data: byGuardian }, { data: byProfile }] = uploaderIds.length
    ? await Promise.all([
        db.from("guardians").select("user_id, full_name").in("user_id", uploaderIds),
        db.from("profiles").select("id, full_name").in("id", uploaderIds),
      ])
    : [{ data: [] }, { data: [] }];
  const uploaderName = new Map<string, string>([
    ...(byProfile ?? []).map((u) => [u.id, u.full_name] as [string, string]),
    ...(byGuardian ?? []).filter((g) => g.user_id).map((g) => [g.user_id!, g.full_name] as [string, string]),
  ]);

  const withState = roster.map((p) => ({ ...p, visa: visaState(p.medical_visa_expires_on, ctx.today, warnDays) }));
  const pendingIds = new Set(pending.map((d) => d.player_id));
  const blocked = withState.filter((p) => (p.visa.state === "expired" || p.visa.state === "missing") && !pendingIds.has(p.id));
  const expiring = withState.filter((p) => p.visa.state === "expiring" && !pendingIds.has(p.id))
    .sort((a, b) => (a.medical_visa_expires_on ?? "").localeCompare(b.medical_visa_expires_on ?? ""));
  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  const nameOf = new Map(roster.map((p) => [p.id, p.display_name]));

  const href = (o: { vedere?: string; echipa?: string | null }) => {
    const u = new URLSearchParams();
    const v = o.vedere ?? (view === "all" ? "toti" : "");
    if (v) u.set("vedere", v);
    const e = o.echipa === undefined ? team?.id : o.echipa;
    if (e) u.set("echipa", e);
    const s = u.toString();
    return `/lot/vize${s ? `?${s}` : ""}`;
  };

  const PlayerCell = ({ id, name, gid }: { id: string; name: string; gid: string | null }) => (
    <span className="min-w-0">
      <Link href={`/lot/jucatori/${id}`} className="font-semibold hover:underline">{name}</Link>
      <span className="block text-sm text-ink-3">{teamName(gid)}</span>
    </span>
  );

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={teams.length > 1 ? (
          <NavSelect label={t.filterTeam} value={team?.id ?? ""} className="w-full sm:w-56"
            options={[{ value: "", label: getT().performance.medical.allTeams, href: href({ echipa: null }) }, ...teams.map((g) => ({ value: g.id, label: g.name, href: href({ echipa: g.id }) }))]} />
        ) : undefined} />
      <TabLinks className="mb-4" current={view} tabs={[
        { key: "todo", href: href({ vedere: "" }), label: `${t.views.todo}${pending.length + blocked.length ? ` · ${pending.length + blocked.length}` : ""}` },
        { key: "all", href: href({ vedere: "toti" }), label: t.views.all },
      ]} />

      {view === "todo" ? (
        pending.length + blocked.length + expiring.length === 0 ? <EmptyState title={t.allGood} /> : (
          <div className="space-y-4">
            {pending.length ? (
              <Card>
                <CardHeader title={`${t.pending} · ${pending.length}`} />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {pending.map((d) => {
                      const p = roster.find((x) => x.id === d.player_id)!;
                      return (
                        <li key={d.id} className="grid justify-items-start gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-items-stretch">
                          <span className="min-w-0">
                            <PlayerCell id={p.id} name={p.display_name} gid={p.group_id} />
                            <span className="block text-sm text-ink-3">
                              {t.uploadedBy(uploaderName.get(d.uploaded_by ?? "") ?? "—", formatDateShort(d.uploaded_at.slice(0, 10)))}
                              {d.issued_on ? ` · ${t.issuedOn.toLowerCase()} ${formatDate(d.issued_on)}` : ""}
                            </span>
                          </span>
                          {manage ? <VisaDecision doc={{ id: d.id, issued_on: d.issued_on, path: d.storage_path }} playerName={p.display_name} today={ctx.today} validityMonths={months} /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
            {blocked.length ? (
              <Card>
                <CardHeader title={`${t.expired} · ${blocked.length}`} action={manage ? <VisaRemindButton playerIds={blocked.map((p) => p.id)} /> : undefined} />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {blocked.map((p) => {
                      const last = latest.get(p.id);
                      return (
                        <li key={p.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                          <PlayerCell id={p.id} name={p.display_name} gid={p.group_id} />
                          <span className="flex flex-col items-start gap-1 sm:items-end">
                            <VisaChip {...p.visa} expires={p.medical_visa_expires_on} />
                            {last?.status === "rejected" ? <span className="text-sm text-st-red">{t.statusRejected(last.reject_reason ?? "")}</span> : null}
                          </span>
                          {manage ? <VisaUploadButton playerId={p.id} playerName={p.display_name} today={ctx.today} variant="secondary" size="sm" /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
            {expiring.length ? (
              <Card>
                <CardHeader title={`${t.expiring(warnDays)} · ${expiring.length}`} action={manage ? <VisaRemindButton playerIds={expiring.map((p) => p.id)} /> : undefined} />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {expiring.map((p) => (
                      <li key={p.id} className="grid justify-items-start gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-items-stretch">
                        <PlayerCell id={p.id} name={p.display_name} gid={p.group_id} />
                        <VisaChip {...p.visa} expires={p.medical_visa_expires_on} />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
          </div>
        )
      ) : (
        <TableWrap>
          <>
            <thead>
              <tr><th scope="col">{t.cols.player}</th><th scope="col">{t.cols.team}</th><th scope="col">{t.cols.expires}</th><th scope="col">{t.cols.state}</th><th scope="col">{t.cols.doc}</th></tr>
            </thead>
            <tbody>
              {withState.map((p) => {
                const last = latest.get(p.id);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/lot/jucatori/${p.id}`} className="font-semibold hover:underline">{nameOf.get(p.id)}</Link></td>
                    <td>{teamName(p.group_id)}</td>
                    <td className="tabular-nums">{p.medical_visa_expires_on ? formatDate(p.medical_visa_expires_on) : "—"}</td>
                    <td><VisaChip {...p.visa} expires={p.medical_visa_expires_on} /></td>
                    <td className="text-sm">
                      {last ? (last.status === "pending" ? t.statusPending : last.status === "rejected" ? t.statusRejected(last.reject_reason ?? "") : last.valid_until ? formatDate(last.valid_until) : "—") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </>
        </TableWrap>
      )}
    </>
  );
}

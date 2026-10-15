import Link from "next/link";
import { CONSENT_VERSION, ROLE_LABELS, formatDateShort, formatDateTime, isMinor, label, plural, unwrap } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { PlayerDataActions, RequestCard, type RequestItem } from "@/components/admin/gdpr-panels";
import { getT } from "@/messages";

export const metadata = { title: "GDPR" };

/** Cererile utilizatorilor, situația consimțămintelor și jucătorii a căror perioadă de păstrare a expirat. */
export default async function Page() {
  const { db, ctx } = await requireRole("physio");
  const t = getT().admin.gdpr;
  const tz = ctx.settings.timezone;

  const [requestsRes, playersRes, consentsRes, staffRes, dueRes] = await Promise.all([
    db.from("data_requests")
      .select("*, requester:profiles!data_requests_user_id_fkey(full_name, role), handler:profiles!data_requests_handled_by_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(200),
    db.from("players").select("id, display_name, birth_date, user_id, group_id, is_active, anonymized_at, created_at").order("display_name"),
    db.from("consents").select("id, user_id, player_id, kind, text_version, accepted_at, withdrawn_at"),
    db.from("profiles").select("id, role, is_active").neq("role", "player"),
    db.rpc("players_past_retention"),
  ]);
  const players = unwrap(playersRes);
  const consents = unwrap(consentsRes);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const activeConsents = (playerId: string) => consents.filter((c) => c.player_id === playerId && !c.withdrawn_at);
  const gdprPlayer = (id: string) => {
    const p = playerById.get(id);
    return p ? { id: p.id, displayName: p.display_name, anonymized: !!p.anonymized_at, hasAccount: !!p.user_id } : null;
  };

  // --- cereri
  const requests: RequestItem[] = unwrap(requestsRes).map((r) => {
    const p = r.player_id ? gdprPlayer(r.player_id) : null;
    return {
      id: r.id,
      kind: r.kind as RequestItem["kind"],
      status: r.status as RequestItem["status"],
      who: r.requester?.full_name ?? t.deletedAccount,
      whoRole: r.requester ? label(ROLE_LABELS, r.requester.role) : null,
      player: p ? { ...p, activeConsents: activeConsents(p.id).length } : null,
      message: r.message,
      createdAt: formatDateTime(r.created_at, tz),
      handledBy: r.handler?.full_name ?? null,
      handledAt: r.handled_at ? formatDateTime(r.handled_at, tz) : null,
      response: r.response,
    };
  });
  const open = requests.filter((r) => r.status === "open");
  const closed = requests.filter((r) => r.status !== "open").slice(0, 30);

  // --- consimțăminte (aceeași regulă ca la autentificare: minor = acordul părintelui; adult = acordul propriu, versiunea curentă)
  const current = players.filter((p) => p.is_active && !p.anonymized_at);
  const hasGuardian = (id: string) => activeConsents(id).some((c) => c.kind === "guardian_digital" || c.kind === "guardian_paper");
  const withAccount = current.filter((p) => p.user_id);
  const accepted = withAccount.filter((p) =>
    isMinor(p.birth_date, ctx.today) === true ? hasGuardian(p.id) : activeConsents(p.id).some((c) => c.user_id === p.user_id && c.text_version === CONSENT_VERSION));
  const minorsMissing = current.filter((p) => isMinor(p.birth_date, ctx.today) === true && !hasGuardian(p.id));
  const unknownAge = current.filter((p) => !p.birth_date).length;
  const withdrawn = consents.filter((c) => c.withdrawn_at).sort((a, b) => (b.withdrawn_at ?? "").localeCompare(a.withdrawn_at ?? ""));
  const outdated = consents.filter((c) => !c.withdrawn_at && c.text_version !== CONSENT_VERSION).length;
  const staff = (staffRes.data ?? []).filter((s) => s.is_active);
  const staffAccepted = staff.filter((s) => consents.some((c) => c.user_id === s.id && c.kind === "staff_confidentiality" && !c.withdrawn_at && c.text_version === CONSENT_VERSION)).length;

  // --- retenție
  const due = dueRes.data ?? [];
  const dueIds = new Set(due.map((d) => d.player_id));
  const inactive = players.filter((p) => !p.is_active && !p.anonymized_at && !dueIds.has(p.id));
  const anonymized = players.filter((p) => p.anonymized_at);
  const months = ctx.settings.retention_months;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t.statOpen} value={open.length} tone={open.length ? "orange" : undefined} />
        <Stat label={t.statConsent} value={`${accepted.length} / ${withAccount.length}`} hint={t.statConsentHint} />
        <Stat label={t.statMinors} value={minorsMissing.length} tone={minorsMissing.length ? "red" : undefined} />
        <Stat label={t.statRetention} value={due.length} tone={due.length ? "orange" : undefined} />
      </div>

      <div className="space-y-5">
        <Card id="cereri">
          <CardHeader title={t.requestsTitle} description={t.requestsHint} />
          <CardBody className="space-y-4">
            {open.length ? (
              <ul className="divide-y divide-line border-y border-line">
                {open.map((r) => <RequestCard key={r.id} request={r} />)}
              </ul>
            ) : <EmptyState title={t.noOpenTitle} description={t.noOpen} />}
            {closed.length ? (
              <details>
                <summary className="flex h-12 cursor-pointer items-center font-semibold">{t.closedTitle(closed.length)}</summary>
                <ul className="mt-1 divide-y divide-line border-y border-line">
                  {closed.map((r) => <RequestCard key={r.id} request={r} />)}
                </ul>
              </details>
            ) : null}
          </CardBody>
        </Card>

        <Card id="consimtaminte">
          <CardHeader title={t.consentsTitle} description={t.consentsHint(CONSENT_VERSION)} />
          <CardBody className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {[
                [t.consentPlayers, t.ofTotal(accepted.length, withAccount.length)],
                [t.consentStaff, t.ofTotal(staffAccepted, staff.length)],
                [t.consentWithdrawnCount, String(withdrawn.length)],
                [t.consentOutdated, String(outdated)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h3 className="mb-1">{t.minorsTitle(minorsMissing.length)}</h3>
              {minorsMissing.length ? (
                <>
                  <p className="mb-2 text-sm text-ink-3">{t.minorsHint}</p>
                  <ul className="divide-y divide-line border-y border-line">
                    {minorsMissing.map((p) => (
                      <li key={p.id}>
                        <Link href={`/lot/jucatori/${p.id}/stare`} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 px-3 py-2 hover:bg-canvas">
                          <span className="font-semibold underline underline-offset-4">{p.display_name}</span>
                          <span className="flex items-center gap-2 text-sm text-ink-3">
                            {p.group_id ? groupName.get(p.group_id) : null}
                            <Badge tone={p.user_id ? "yellow" : "outline"}>{p.user_id ? t.hasAccount : t.noAccount}</Badge>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="text-sm text-ink-3">{t.minorsNone}</p>}
              {unknownAge ? <Notice tone="yellow" className="mt-3">{t.unknownAge(unknownAge)}</Notice> : null}
            </section>

            {withdrawn.length ? (
              <section>
                <h3 className="mb-1">{t.withdrawnTitle}</h3>
                <ul className="divide-y divide-line border-y border-line">
                  {withdrawn.slice(0, 30).map((c) => {
                    const p = c.player_id ? playerById.get(c.player_id) : null;
                    return (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-2">
                        {p ? <Link href={`/lot/jucatori/${p.id}/stare`} className="font-semibold underline underline-offset-4">{p.display_name}</Link> : <span>{t.staffAccount}</span>}
                        <span className="text-sm text-ink-3">{t.consentKinds[c.kind as keyof typeof t.consentKinds] ?? c.kind} · {t.withdrawnOn(formatDateTime(c.withdrawn_at, tz))}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </CardBody>
        </Card>

        <Card id="retentie">
          <CardHeader title={t.retentionTitle} description={t.retentionHint(plural(months, t.monthOne, t.monthMany))} />
          <CardBody className="space-y-4">
            <Notice tone="blue" title={t.differenceTitle}>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>{t.diffDeactivate}</strong> — {t.diffDeactivateText}</li>
                <li><strong>{t.diffAnonymize}</strong> — {t.diffAnonymizeText}</li>
                <li><strong>{t.diffErase}</strong> — {t.diffEraseText}</li>
              </ul>
            </Notice>

            <section>
              <h3 className="mb-1">{t.dueTitle(due.length)}</h3>
              {due.length ? (
                <ul className="divide-y divide-line border-y border-line">
                  {due.map((d) => {
                    const p = gdprPlayer(d.player_id);
                    return p ? (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <span>
                          <Link href={`/lot/jucatori/${p.id}/stare`} className="font-semibold underline underline-offset-4">{p.displayName}</Link>
                          <span className="block text-sm text-ink-3">{t.inactiveSince(formatDateShort(d.inactive_since.slice(0, 10)))}</span>
                        </span>
                        <PlayerDataActions player={p} withExport={false} />
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : <p className="text-sm text-ink-3">{t.dueNone}</p>}
            </section>

            {inactive.length ? (
              <section>
                <h3 className="mb-1">{t.inactiveTitle(inactive.length)}</h3>
                <p className="mb-2 text-sm text-ink-3">{t.inactiveHint}</p>
                <ul className="divide-y divide-line border-y border-line">
                  {inactive.map((pl) => {
                    const p = gdprPlayer(pl.id)!;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <Link href={`/lot/jucatori/${p.id}/stare`} className="font-semibold underline underline-offset-4">{p.displayName}</Link>
                        <PlayerDataActions player={p} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {anonymized.length ? (
              <section>
                <h3 className="mb-1">{t.anonymizedTitle(anonymized.length)}</h3>
                <p className="mb-2 text-sm text-ink-3">{t.anonymizedHint}</p>
                <ul className="divide-y divide-line border-y border-line">
                  {anonymized.map((pl) => {
                    const p = gdprPlayer(pl.id)!;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <span>
                          <span className="font-semibold">{p.displayName}</span>
                          <span className="block text-sm text-ink-3">{t.anonymizedOn(formatDateShort(pl.anonymized_at!.slice(0, 10)))}</span>
                        </span>
                        <PlayerDataActions player={p} withExport={false} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            <p className="text-sm text-ink-3">{t.activePlayersNote}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

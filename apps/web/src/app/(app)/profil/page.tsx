import { Check, Clock, Download, KeyRound, LogOut, X } from "lucide-react";
import {
  FEET, POSITIONS, ROLE_LABELS, diffDays, formatDate, formatDateShort, isMinor, label, plural, todayIn,
} from "@club/shared";
import { requireSession, type Session } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { fileUrl } from "@/lib/storage";
import { Button, LinkButton, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice, PageHeader } from "@/components/ui/card";
import { DataList, TabLinks } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { AccountForm } from "@/components/player/account-form";
import { ContactForm } from "@/components/player/contact-form";
import { Evolution } from "@/components/player/evolution";
import { GdprRequests } from "@/components/player/gdpr-requests";
import { NoPlayer } from "@/components/player/no-player";
import { PhotoUpload } from "@/components/player/photo-upload";
import { getContact, getMyConsent, listMyRequests } from "@/components/player/queries";
import { getT } from "@/messages";

export const metadata = { title: "Profil" };

type Section = "fisa" | "evolutie" | "cont" | "date";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ sectiune?: string | string[]; zile?: string | string[] }> }) {
  // pagina este a tuturor rolurilor: staff-ul vede doar „Cont" și „Datele mele"
  const { db, ctx, email } = await requireSession();
  const t = getT().player;
  const sp = await searchParams;
  const isPlayer = ctx.role === "player";
  const sections: Section[] = isPlayer ? ["fisa", "evolutie", "cont", "date"] : ["cont", "date"];
  const section = sections.find((s) => s === sp.sectiune) ?? sections[0];
  const href = (s: Section) => (s === sections[0] ? "/profil" : `/profil?sectiune=${s}`);

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.profile.title} description={isPlayer ? undefined : ROLE_LABELS[ctx.role]} />
      <TabLinks className="mb-4" current={section} tabs={sections.map((s) => ({ key: s, href: href(s), label: t.profile.sections[s] }))} />

      {section === "fisa" ? <PlayerSheet db={db} ctx={ctx} email={email} /> : null}
      {section === "evolutie" ? (
        ctx.player ? (
          <Evolution
            db={db}
            player={ctx.player}
            today={ctx.today}
            days={sp.zile === "28" ? 28 : 7}
            hrefFor={(d) => (d === 7 ? "/profil?sectiune=evolutie" : "/profil?sectiune=evolutie&zile=28")}
          />
        ) : <NoPlayer />
      ) : null}
      {section === "cont" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader title={t.account.title} />
            <CardBody>
              <AccountForm
                fullName={ctx.profile.full_name}
                email={email ?? ctx.profile.email}
                phone={ctx.profile.phone}
                emailNotifications={ctx.profile.email_notifications}
                showPhone={!isPlayer}
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-2">
              <LinkButton href="/parola" className="w-full" icon={<KeyRound className="size-5" aria-hidden />}>{t.account.changePassword}</LinkButton>
              <form action={signOut}>
                <Button type="submit" variant="secondary" className="w-full" icon={<LogOut className="size-5" aria-hidden />}>{t.account.signOut}</Button>
              </form>
            </CardBody>
          </Card>
        </div>
      ) : null}
      {section === "date" ? <MyData db={db} ctx={ctx} email={email} /> : null}
    </div>
  );
}

async function PlayerSheet({ db, ctx }: Pick<Session, "db" | "ctx" | "email">) {
  const t = getT().player;
  if (!ctx.player) return <NoPlayer />;
  const p = ctx.player;
  const photoUrl = fileUrl("avatars", p.photo_path);
  const contact = await getContact(db, p.id);
  const minor = isMinor(p.birth_date, ctx.today) === true;
  const group = ctx.groups.find((g) => g.id === p.group_id);
  const visaDays = p.medical_visa_expires_on ? diffDays(ctx.today, p.medical_visa_expires_on) : null;
  const position = [label(POSITIONS, p.position, ""), p.position_detail].filter(Boolean).join(" · ");
  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <PhotoUpload playerId={p.id} name={p.full_name} photoUrl={photoUrl} hasPhoto={!!p.photo_path} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sheet.title} description={t.sheet.readOnly} />
        <CardBody>
          <DataList
            items={[
              { label: t.sheet.fullName, value: p.full_name },
              { label: t.sheet.birthDate, value: p.birth_date ? formatDate(p.birth_date) : "—" },
              { label: t.sheet.position, value: position || "—" },
              { label: t.sheet.foot, value: label(FEET, p.dominant_foot) },
              { label: t.sheet.group, value: group?.name ?? "—" },
              { label: t.sheet.number, value: p.shirt_number ?? "—" },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.visa.title} />
        <CardBody>
          {visaDays === null ? (
            <p className="text-ink-3">{t.visa.missing}</p>
          ) : visaDays < 0 ? (
            <Notice tone="red" title={t.visa.expired(formatDate(p.medical_visa_expires_on))}>{t.visa.action}</Notice>
          ) : visaDays <= ctx.settings.alerts.visa_days_before ? (
            <Notice tone="yellow" title={t.visa.expiring(visaDays === 0 ? null : plural(visaDays, "zi", "zile"), formatDate(p.medical_visa_expires_on))}>
              {t.visa.action}
            </Notice>
          ) : (
            <p>
              {t.visa.validUntil} <span className="font-bold">{formatDate(p.medical_visa_expires_on)}</span>
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.contact.title} description={minor ? t.contact.hintMinor : t.contact.hint} />
        <CardBody>
          <ContactForm
            minor={minor}
            initial={{
              phone: contact?.phone ?? ctx.profile.phone ?? "",
              email: contact?.email ?? "",
              guardianName: contact?.guardian_name ?? "",
              guardianPhone: contact?.guardian_phone ?? "",
              guardianEmail: contact?.guardian_email ?? "",
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

async function MyData({ db, ctx }: Pick<Session, "db" | "ctx" | "email">) {
  const t = getT().player;
  const [requests, consent] = await Promise.all([listMyRequests(db, ctx.userId), getMyConsent(db, ctx.userId, ctx.player?.id ?? null)]);
  const openKinds = requests.filter((r) => r.status === "open").map((r) => r.kind);
  const statusTone = { open: "yellow", done: "green", rejected: "gray" } as const;
  const day = (ts: string) => todayIn(ctx.settings.timezone, new Date(ts));
  const consentDate = consent ? formatDate(day(consent.accepted_at)) : "";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t.gdpr.consentTitle} />
        <CardBody>
          {consent ? (
            <p>
              {consent.kind === "guardian_digital" || consent.kind === "guardian_paper"
                ? t.gdpr.consentGuardian(consentDate, consent.guardian_name)
                : consent.kind === "staff_confidentiality"
                  ? t.gdpr.consentStaff(consentDate)
                  : t.gdpr.consentSelf(consentDate)}
            </p>
          ) : (
            <p className="text-ink-3">{t.gdpr.consentMissing}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.gdpr.exportTitle} description={t.gdpr.exportHint} />
        <CardBody>
          {/* descărcare de fișier: link simplu, fără navigare în aplicație */}
          <a href="/profil/export" download className={buttonClass("primary", "md", "w-full sm:w-auto")}>
            <Download className="size-5" aria-hidden />
            {t.gdpr.exportButton}
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.gdpr.requestsTitle} description={t.gdpr.requestsHint} />
        <CardBody>
          <GdprRequests openKinds={openKinds} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.gdpr.listTitle} />
        <CardBody>
          {requests.length ? (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{t.gdpr.kindLabels[r.kind as keyof typeof t.gdpr.kindLabels] ?? r.kind}</p>
                      <p className="text-sm text-ink-3">{formatDateShort(day(r.created_at))}</p>
                    </div>
                    <Badge tone={statusTone[r.status as keyof typeof statusTone] ?? "gray"}>
                      {r.status === "done" ? <Check className="size-3.5" aria-hidden /> : r.status === "rejected" ? <X className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                      {t.gdpr.statusLabels[r.status as keyof typeof t.gdpr.statusLabels] ?? r.status}
                    </Badge>
                  </div>
                  {r.message ? <p className="mt-1 text-sm text-ink-2">{t.gdpr.yourMessage}: {r.message}</p> : null}
                  {r.response ? <p className="mt-1 text-sm text-ink-2">{t.gdpr.clubResponse}: {r.response}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3">{t.gdpr.listEmpty}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

import { ExternalLink, FileDown, HandHeart } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { ProgressBar, TabLinks } from "@/components/ui/misc";
import { AddPledgeButton, CampaignButton, PledgeTable, SponsorButton } from "@/components/club/supporters-admin";
import { getT } from "@/messages";
import { requestTime } from "@/lib/request-time";

export const metadata = { title: "Suporteri" };

export default async function SupportersPage({ searchParams }: { searchParams: Promise<{ vedere?: string }> }) {
  const { db, ctx } = await requireCapability("manageSupporters");
  const t = getT().club.supporters;
  const sponsorsView = (await searchParams).vedere === "sponsori";
  const header = (action?: React.ReactNode) => (
    <>
      <PageHeader title={t.title} description={t.description} action={action} />
      <TabLinks className="mb-4" current={sponsorsView ? "sponsors" : "forms"} tabs={[
        { key: "forms", href: "/club/suporteri", label: t.tabs.forms },
        { key: "sponsors", href: "/club/suporteri?vedere=sponsori", label: t.tabs.sponsors },
      ]} />
    </>
  );

  if (sponsorsView) {
    const { data } = await db.from("sponsors").select("*").order("status").order("name");
    const sum = (data ?? []).filter((s) => s.status === "signed" || s.status === "paid").reduce((a, s) => a + (s.amount ?? 0), 0);
    const soon = new Date(requestTime() + 45 * 86400e3).toISOString().slice(0, 10);
    return (
      <>
        {header(<SponsorButton clubId={ctx.club.id} />)}
        {!data?.length ? <EmptyState icon={<HandHeart className="size-8" aria-hidden />} title={t.sponsors.empty} /> : (
          <div className="space-y-3">
            <p className="font-semibold">{t.sponsors.total(formatLei(sum))}</p>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.map((s) => (
                <li key={s.id} className="flex gap-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
                  {s.logo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/site/${s.logo_path}`} alt="" className="h-14 w-20 shrink-0 rounded-md border border-line bg-white object-contain p-1" />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2"><span className="flex-1 font-semibold">{s.name}</span>
                      <SponsorButton clubId={ctx.club.id} sponsor={{ id: s.id, name: s.name, fiscalCode: s.fiscal_code ?? "", contactName: s.contact_name ?? "", email: s.email ?? "", phone: s.phone ?? "",
                        kind: s.kind as "money", amount: s.amount ? String(s.amount / 100).replace(".", ",") : "", status: s.status as "prospect", startsOn: s.starts_on ?? "", endsOn: s.ends_on ?? "",
                        tier: s.tier as "partner", url: s.url ?? "", logoPath: s.logo_path, showOnSite: s.show_on_site, notes: s.notes ?? "" }} />
                    </div>
                    <p className="flex flex-wrap gap-1.5">
                      <Badge tone={s.status === "paid" || s.status === "signed" ? "green" : s.status === "ended" ? "gray" : "outline"}>{t.sponsors.statuses[s.status as keyof typeof t.sponsors.statuses]}</Badge>
                      <Badge tone="outline">{t.sponsors.tiers[s.tier as keyof typeof t.sponsors.tiers]}</Badge>
                      {s.ends_on && s.ends_on <= soon && s.ends_on >= ctx.today && s.status !== "ended" ? <Badge tone="yellow">{t.sponsors.expiring}</Badge> : null}
                    </p>
                    <p className="text-sm text-ink-2">{t.sponsors.kinds[s.kind as keyof typeof t.sponsors.kinds]}{s.amount ? ` · ${formatLei(s.amount)}` : ""}{s.starts_on ? ` · ${formatDate(s.starts_on)}${s.ends_on ? ` – ${formatDate(s.ends_on)}` : ""}` : ""}</p>
                    {s.contact_name || s.phone || s.email ? <p className="text-sm text-ink-3">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ")}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  const [{ data: campaigns }, { data: fs }] = await Promise.all([
    db.from("support_campaigns").select("*").order("income_year", { ascending: false }),
    db.from("finance_settings").select("fiscal_code, iban").maybeSingle(),
  ]);
  const active = (campaigns ?? []).find((c) => c.is_active) ?? campaigns?.[0] ?? null;
  const { data: pledges } = active ? await db.from("support_pledges").select("id, full_name, email, phone, two_years, source, status, created_at, notes").eq("campaign_id", active.id).order("created_at", { ascending: false }) : { data: [] };
  const n = (s: string) => (pledges ?? []).filter((p) => p.status === s).length;
  const signed = n("received") + n("submitted");
  const year = Number(ctx.today.slice(0, 4)) - 1;
  return (
    <>
      {header(<div className="flex flex-wrap gap-2">
        <a href={`/c/${ctx.club.slug}/sustine`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors"><ExternalLink className="size-5" aria-hidden />{t.campaign.publicPage}</a>
        {active ? <CampaignButton suggestedYear={year} campaign={{ id: active.id, incomeYear: active.income_year, title: active.title, goal: active.goal ? String(active.goal) : "", deadline: active.deadline ?? "", active: active.is_active }} /> : null}
        {!active || active.income_year < year ? <CampaignButton suggestedYear={year} /> : null}
      </div>)}
      {!fs?.fiscal_code || !fs.iban ? <Notice tone="yellow" title={t.campaign.fiscalMissing} className="mb-4" /> : null}
      {!active ? <EmptyState icon={<HandHeart className="size-8" aria-hidden />} title={t.campaign.none} /> : (
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex-1 text-lg">{active.title}</h2>
                {active.deadline ? <span className="text-sm text-ink-3">{t.campaign.deadline}: {formatDate(active.deadline)}</span> : null}
              </div>
              {active.goal ? <ProgressBar value={signed} max={active.goal} label={t.campaign.goalProgress(signed, active.goal)} /> : null}
              <p className="text-sm text-ink-2">{active.goal ? `${t.campaign.goalProgress(signed, active.goal)} · ` : ""}{t.campaign.stats(n("started"), n("received"), n("submitted"))}</p>
              <p className="text-sm text-ink-3">{t.pledges.privacy}</p>
            </CardBody>
          </Card>
          <div className="flex flex-wrap gap-2">
            <AddPledgeButton />
            <a href="/api/club/suporteri" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors"><FileDown className="size-5" aria-hidden />{t.pledges.csv}</a>
          </div>
          <PledgeTable rows={(pledges ?? []) as never} />
        </div>
      )}
    </>
  );
}

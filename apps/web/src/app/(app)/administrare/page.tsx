import Link from "next/link";
import { Building2, ChevronRight, HeartPulse, ScrollText, ShieldCheck, UserCog, Users } from "lucide-react";
import { plural } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { zonedDayStart } from "@/components/admin/audit";
import { getT } from "@/messages";

export const metadata = { title: "Administrare" };

/** Pagina de pornire a administrării: câte o intrare pe secțiune, cu cifra care contează. */
export default async function Page() {
  const { db, ctx } = await requireRole("physio");
  const t = getT().admin.home;
  const head = { count: "exact", head: true } as const;
  const [accounts, noAccount, openRequests, readsToday] = await Promise.all([
    db.from("profiles").select("id", head).eq("is_active", true),
    db.from("players").select("id", head).eq("is_active", true).is("user_id", null).is("anonymized_at", null),
    db.from("data_requests").select("id", head).eq("status", "open"),
    db.from("audit_log").select("id", head).eq("action", "READ").gte("created_at", zonedDayStart(ctx.today, ctx.settings.timezone)),
  ]);
  const groups = ctx.groups.filter((g) => g.is_active).length;
  const statuses = ctx.statuses.filter((s) => s.is_active).length;
  const n = (r: { count: number | null }) => r.count ?? 0;

  const sections = [
    {
      href: "/administrare/conturi", icon: UserCog, title: t.accounts, text: t.accountsText,
      figure: plural(n(accounts), t.accountOne, t.accountMany),
      flag: n(noAccount) ? t.playersWithoutAccount(n(noAccount)) : null, flagTone: "yellow" as const,
    },
    { href: "/administrare/grupe", icon: Users, title: t.groups, text: t.groupsText, figure: plural(groups, t.groupOne, t.groupMany), flag: null, flagTone: "gray" as const },
    { href: "/administrare/stari", icon: HeartPulse, title: t.statuses, text: t.statusesText, figure: plural(statuses, t.statusOne, t.statusMany), flag: null, flagTone: "gray" as const },
    { href: "/administrare/club", icon: Building2, title: t.club, text: t.clubText, figure: ctx.club.name, flag: null, flagTone: "gray" as const },
    { href: "/administrare/audit", icon: ScrollText, title: t.audit, text: t.auditText, figure: t.readsToday(n(readsToday)), flag: null, flagTone: "gray" as const },
    {
      href: "/administrare/gdpr", icon: ShieldCheck, title: t.gdpr, text: t.gdprText,
      figure: n(openRequests) ? plural(n(openRequests), t.requestOne, t.requestMany) : t.noRequests,
      flag: n(openRequests) ? t.needsAnswer : null, flagTone: "orange" as const,
    },
  ];

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:bg-canvas active:bg-sunken">
              <s.icon className="mt-0.5 size-6 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">{s.title}</span>
                <span className="mt-0.5 block text-sm text-ink-3">{s.text}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-bold">{s.figure}</span>
                  {s.flag ? <Badge tone={s.flagTone}>{s.flag}</Badge> : null}
                </span>
              </span>
              <ChevronRight className="mt-1 size-5 shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

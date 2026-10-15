import Link from "next/link";
import { ChevronRight, Stethoscope } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { getT } from "@/messages";
import { dayOf } from "@/components/players/domain";
import { listMyCases } from "@/components/players/queries";

/** Partenerul medical extern: jucătorii trimiși către el (doar trimiterile active). */
export default async function Page() {
  const { db, ctx } = await requireCapability("partnerCases");
  const t = getT().partner;
  const cases = await listMyCases(db, ctx.userId);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {!cases.length ? (
        <EmptyState icon={<Stethoscope className="size-8" aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-3">{t.count(cases.length)}</p>
          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
            {cases.map((c) => {
              const p = c.players!;
              return (
                <li key={c.id} className="border-b border-line last:border-b-0">
                  <Link href={`/cazuri/${c.id}`} aria-label={t.open(p.display_name)} className="flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-canvas active:bg-sunken">
                    <Avatar name={p.display_name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[1.0625rem] font-bold leading-tight">{p.display_name}</span>
                      {p.full_name !== p.display_name ? <span className="block truncate text-sm text-ink-3">{p.full_name}</span> : null}
                      <span className="mt-0.5 block">{c.reason || <span className="text-ink-3">{t.noReason}</span>}</span>
                      <span className="block text-sm text-ink-3">{t.sentOn(formatDate(dayOf(c.created_at, ctx.settings.timezone)))}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

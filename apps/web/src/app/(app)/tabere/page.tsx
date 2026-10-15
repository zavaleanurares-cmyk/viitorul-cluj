import { CalendarRange, MapPin, Tent } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { FamilyClubTabs } from "@/components/club/family-tabs";
import { CancelRegistrationButton, RegisterButton } from "@/components/club/camp-admin";
import { getT } from "@/messages";

export const metadata = { title: "Tabere" };

const TONE = { pending: "yellow", confirmed: "green", waitlist: "blue", cancelled: "gray" } as const;

/** Taberele deschise, pentru familie: înscriere cu un clic, locul și taxa apar imediat. */
export default async function FamilyCampsPage() {
  const { db, ctx } = await requireRole("guardian", "player");
  const t = getT().club.camps;
  const [{ data: camps }, { data: kids }, { data: regs }] = await Promise.all([
    db.from("camps").select("id, title, description, location, starts_on, ends_on, price, birth_year_from, birth_year_to, deadline, status")
      .eq("status", "open").gte("ends_on", ctx.today).order("starts_on"),
    db.from("players").select("id, full_name, birth_date").eq("is_active", true).order("full_name"),
    db.from("camp_registrations").select("id, camp_id, player_id, child_name, status, camps(title, starts_on, ends_on)").neq("status", "cancelled").order("created_at", { ascending: false }),
  ]);
  const spots = await Promise.all((camps ?? []).map((c) => db.rpc("camp_spots", { p_camp: c.id }).then((r) => (r.data as number | null) ?? 0)));
  const minorPlayer = ctx.role === "player" && (!ctx.player?.birth_date || ctx.player.birth_date > `${Number(ctx.today.slice(0, 4)) - 18}${ctx.today.slice(4)}`);
  const mine = (regs ?? []) as Array<{ id: string; camp_id: string; player_id: string | null; child_name: string; status: string; camps: { title: string; starts_on: string; ends_on: string } | null }>;
  return (
    <div className="max-w-2xl space-y-6">
      <FamilyClubTabs current="camps" />
      <PageHeader title={t.family.title} description={t.family.description} />
      {mine.length ? (
        <section>
          <h2 className="mb-2 text-lg">{t.family.mine}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.camps?.title}</span>
                  <span className="block text-sm text-ink-3">{r.child_name} · {r.camps ? t.dates(formatDate(r.camps.starts_on), formatDate(r.camps.ends_on)) : ""}</span>
                </span>
                <Badge tone={TONE[r.status as keyof typeof TONE]}>{t.regStatus[r.status as keyof typeof t.regStatus]}</Badge>
                {r.camps && r.camps.starts_on > ctx.today ? <CancelRegistrationButton id={r.id} campId={r.camp_id} label={t.family.cancel} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!camps?.length ? <EmptyState icon={<Tent className="size-8" aria-hidden />} title={t.family.none} /> : camps.map((c, i) => {
        const year = (b: string | null) => (b ? Number(b.slice(0, 4)) : null);
        const taken = new Set(mine.filter((r) => r.camp_id === c.id).map((r) => r.player_id));
        const eligible = (kids ?? []).filter((k) => !taken.has(k.id) && (year(k.birth_date) === null
          || ((!c.birth_year_from || year(k.birth_date)! >= c.birth_year_from) && (!c.birth_year_to || year(k.birth_date)! <= c.birth_year_to))));
        const closed = (c.deadline ?? c.starts_on) < ctx.today;
        return (
          <Card key={c.id}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl">{c.title}</h2>
                <span className="shrink-0 text-lg font-bold">{c.price ? formatLei(c.price) : t.free}</span>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
                <span className="inline-flex items-center gap-1"><CalendarRange className="size-5" aria-hidden />{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}</span>
                {c.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-5" aria-hidden />{c.location}</span> : null}
              </p>
              <p className="text-sm text-ink-3">{t.years(c.birth_year_from, c.birth_year_to)}{c.deadline ? ` · ${t.deadline(formatDate(c.deadline))}` : ""} · {t.spotsLeft(spots[i])}</p>
              {c.description ? <p className="whitespace-pre-line text-ink-2">{c.description}</p> : null}
              {closed ? null : minorPlayer ? <p className="text-sm text-ink-2">{t.family.askParent}</p> : eligible.length ? (
                <RegisterButton campId={c.id} campTitle={c.title} players={eligible.map((k) => ({ id: k.id, name: k.full_name }))}
                  priceNote={c.price ? t.family.priceNote(formatLei(c.price)) : null} />
              ) : !taken.size ? <p className="text-sm text-ink-3">{t.family.noEligible}</p> : null}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

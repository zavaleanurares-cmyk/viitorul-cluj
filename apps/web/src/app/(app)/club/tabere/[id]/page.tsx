import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, ChevronLeft, FileDown, MapPin } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { ProgressBar, TableWrap } from "@/components/ui/misc";
import { CampFormButton, CancelRegistrationButton, ConfirmButton, PaidToggle, RegisterButton, WaitlistButton } from "@/components/club/camp-admin";
import { getT } from "@/messages";

export const metadata = { title: "Tabără" };

type Reg = {
  id: string; player_id: string | null; child_name: string; birth_date: string | null; parent_name: string | null; parent_email: string | null;
  parent_phone: string | null; notes: string | null; status: string; source: string; charge_id: string | null; paid_external: boolean; created_at: string;
};
const ORDER = ["pending", "confirmed", "waitlist", "cancelled"] as const;

export default async function CampPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("manageCamps");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().club.camps;
  const { data: c } = await db.from("camps").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: regsRaw }, { data: players }] = await Promise.all([
    db.from("camp_registrations").select("id, player_id, child_name, birth_date, parent_name, parent_email, parent_phone, notes, status, source, charge_id, paid_external, created_at").eq("camp_id", id).order("created_at"),
    db.from("players").select("id, full_name, birth_date, group_id").eq("is_active", true).is("anonymized_at", null).order("full_name"),
  ]);
  const regs = (regsRaw ?? []) as Reg[];
  const pids = regs.map((r) => r.player_id).filter(Boolean) as string[];
  const { data: gps } = pids.length ? await db.from("guardian_players").select("player_id, is_billing, guardians(full_name, phone, email)").in("player_id", pids) : { data: [] };
  for (const r of regs) {
    if (!r.player_id || r.parent_name) continue;
    const g = (gps ?? []).filter((x) => x.player_id === r.player_id).sort((a, b) => Number(b.is_billing) - Number(a.is_billing))[0]?.guardians as { full_name: string; phone: string | null; email: string | null } | null | undefined;
    if (g) Object.assign(r, { parent_name: g.full_name, parent_phone: g.phone, parent_email: g.email });
  }
  const chargeIds = regs.map((r) => r.charge_id).filter(Boolean) as string[];
  const { data: balances } = chargeIds.length ? await db.from("charge_balances").select("id, state").in("id", chargeIds) : { data: [] };
  const state = new Map((balances ?? []).map((b) => [b.id, b.state]));
  const team = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "";
  const pl = (players ?? []).map((p) => ({ id: p.id, name: p.full_name, birth: p.birth_date, team: team(p.group_id) }));
  const registered = new Set(regs.filter((r) => r.status !== "cancelled" && r.player_id).map((r) => r.player_id));
  const eligible = (players ?? []).filter((p) => !registered.has(p.id) && (!p.birth_date || (
    (!c.birth_year_from || Number(p.birth_date.slice(0, 4)) >= c.birth_year_from) && (!c.birth_year_to || Number(p.birth_date.slice(0, 4)) <= c.birth_year_to))));
  const taken = regs.filter((r) => r.status === "confirmed").length;
  const camp = {
    id: c.id, title: c.title, description: c.description ?? "", location: c.location ?? "", startsOn: c.starts_on, endsOn: c.ends_on,
    price: c.price ? String(c.price / 100).replace(".", ",") : "", capacity: c.capacity, yearFrom: c.birth_year_from ?? "", yearTo: c.birth_year_to ?? "",
    deadline: c.deadline ?? "", status: c.status as "open", isPublic: c.is_public,
  };
  const pay = (r: Reg) => {
    if (r.status === "cancelled") return null;
    if (r.charge_id) {
      const s = state.get(r.charge_id);
      return <Badge tone={s === "paid" || s === "waived" ? "green" : "outline"}>{s === "paid" || s === "waived" ? t.payment.paidLedger : t.payment.openLedger}</Badge>;
    }
    if (!c.price) return <span className="text-ink-3">{t.payment.free}</span>;
    return r.status === "confirmed" ? <PaidToggle id={r.id} campId={id} paid={r.paid_external} /> : null;
  };
  return (
    <div className="space-y-4">
      <PageHeader
        back={<Link href="/club/tabere" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>}
        title={c.title}
        description={<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge tone={c.status === "open" ? "green" : "gray"}>{t.status[c.status as keyof typeof t.status]}</Badge>
          <span className="inline-flex items-center gap-1"><CalendarRange className="size-4" aria-hidden />{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}</span>
          {c.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{c.location}</span> : null}
          <span>{t.years(c.birth_year_from, c.birth_year_to)} · {c.price ? formatLei(c.price) : t.free}</span>
        </span>}
        action={<div className="flex flex-wrap gap-2">
          <a href={`/api/club/tabara/${c.id}`} className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] border border-border-control bg-surface px-4 font-semibold hover:bg-canvas"><FileDown className="size-5" aria-hidden />{t.actions.pdf}</a>
          <CampFormButton camp={camp} />
        </div>}
      />
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="min-w-56 flex-1 space-y-1">
            <ProgressBar value={taken} max={c.capacity} label={t.taken(taken, c.capacity)} />
            <p className="text-sm text-ink-2">{t.taken(taken, c.capacity)}</p>
          </div>
          {c.status === "open" || c.status === "closed" ? (
            <RegisterButton office campId={c.id} campTitle={c.title} players={eligible.map((p) => ({ id: p.id, name: `${p.full_name} · ${team(p.group_id)}` }))} priceNote={null} />
          ) : null}
        </CardBody>
      </Card>
      {ORDER.map((st) => {
        const rows = regs.filter((r) => r.status === st);
        if (!rows.length) return null;
        return (
          <section key={st}>
            <h2 className="mb-2 flex items-center gap-2 text-lg">{t.regStatus[st]}<span className="text-base font-normal text-ink-3">· {rows.length}</span></h2>
            <TableWrap>
                <thead>
                  <tr><th>{t.cols.child}</th><th>{t.cols.parent}</th><th>{t.cols.notes}</th><th>{t.cols.payment}</th><th><span className="sr-only">—</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td>
                        <span className="block font-semibold">{r.player_id ? <Link href={`/lot/jucatori/${r.player_id}`} className="hover:underline">{r.child_name}</Link> : r.child_name}</span>
                        <span className="block text-sm text-ink-3">{r.birth_date ? r.birth_date.slice(0, 4) : ""} · {t.source[r.source as keyof typeof t.source]}</span>
                      </td>
                      <td className="text-sm">
                        {r.parent_name ? <span className="block">{r.parent_name}</span> : null}
                        {r.parent_phone ? <a className="block underline underline-offset-2" href={`tel:${r.parent_phone}`}>{r.parent_phone}</a> : null}
                        {r.parent_email ? <a className="block break-all underline underline-offset-2" href={`mailto:${r.parent_email}`}>{r.parent_email}</a> : null}
                      </td>
                      <td className="max-w-64 text-sm whitespace-pre-line">{r.notes}</td>
                      <td>{pay(r)}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.status === "pending" || r.status === "waitlist" ? <ConfirmButton id={r.id} campId={id} childName={r.child_name} birth={r.birth_date} players={pl} /> : null}
                          {r.status === "pending" ? <WaitlistButton id={r.id} campId={id} /> : null}
                          {r.status !== "cancelled" ? <CancelRegistrationButton id={r.id} campId={id} icon /> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </TableWrap>
          </section>
        );
      })}
      {c.description ? <Card><CardBody><p className="whitespace-pre-line text-ink-2">{c.description}</p></CardBody></Card> : null}
    </div>
  );
}

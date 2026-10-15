import { BONUS_TRIGGER_LABELS, addDays, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { BonusEntries, BonusRuleButton, ComputeButton, DeleteRuleButton, type BonusEntry } from "@/components/money/bonuses";
import { getT } from "@/messages";

export const metadata = { title: "Prime" };

export default async function BonusesPage() {
  const { db, ctx } = await requireCapability("administerMoney");
  const t = getT().money.bonuses;
  const [rules, entries, comps] = await Promise.all([
    db.from("bonus_rules").select("id, name, target, trigger, amount, group_id, competition_id").is("deleted_at", null).order("created_at"),
    db.from("bonus_entries").select("id, quantity, amount, status, rule_id, players(full_name), profiles!bonus_entries_profile_id_fkey(full_name), events(starts_at, title)").order("created_at", { ascending: false }).limit(300),
    db.from("competitions").select("id, name").eq("is_active", true).order("name"),
  ]);
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const compName = new Map((comps.data ?? []).map((c) => [c.id, c.name]));
  const ruleName = new Map((rules.data ?? []).map((r) => [r.id, r.name]));
  const list: BonusEntry[] = (entries.data ?? []).map((e) => {
    const ev = e.events as { starts_at: string; title: string } | null;
    return {
      id: e.id, quantity: e.quantity, amount: e.amount, status: e.status, rule: ruleName.get(e.rule_id) ?? "",
      who: (e.players as { full_name: string } | null)?.full_name ?? (e.profiles as { full_name: string } | null)?.full_name ?? "—",
      match: ev?.title ?? "", date: ev?.starts_at.slice(0, 10) ?? "",
    };
  });
  const teams = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, label: g.name }));
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader title={t.rulesTitle} action={<BonusRuleButton teams={teams} competitions={(comps.data ?? []).map((c) => ({ id: c.id, label: c.name }))} />} />
          <CardBody>
            {(rules.data ?? []).length === 0 ? <p className="text-ink-3">{t.rulesEmpty}</p> : (
              <ul className="divide-y divide-line">
                {(rules.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.name}</span>
                      <span className="block text-sm text-ink-3">{t.perUnit(formatLei(r.amount), BONUS_TRIGGER_LABELS[r.trigger])} · {t.fields.targets[r.target as "player"]}
                        {r.group_id ? ` · ${groupName.get(r.group_id) ?? ""}` : ""}{r.competition_id ? ` · ${compName.get(r.competition_id) ?? ""}` : ""}</span>
                    </span>
                    <DeleteRuleButton id={r.id} label={getT().money.common.delete} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.entriesTitle} />
          <CardBody className="space-y-4">
            <ComputeButton from={addDays(ctx.today, -30)} to={ctx.today} />
            {list.length === 0 ? <EmptyState title={t.entriesEmpty} /> : <BonusEntries entries={list} />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

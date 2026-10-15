import Link from "next/link";
import { Check } from "lucide-react";
import { addDays, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KitSizeSelect } from "@/components/club/kit-size";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

type Child = { id: string; full_name: string; enrolled_on: string | null; medical_visa_expires_on: string | null; kit_size: string | null };

function Item({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2", done ? "border-st-green bg-st-green text-white" : "border-line-strong")}>
        {done ? <Check className="size-4" aria-hidden /> : null}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/**
 * Primii pași după înscriere (doar pentru copiii înscriși în ultimele 60 de zile cu ceva neterminat):
 * contractul semnat, avizul medical, mărimea echipamentului.
 */
export async function FamilyOnboardingCard({ db, kids, today, visaPending }: { db: Db; kids: Child[]; today: string; visaPending: Set<string> }) {
  const fresh = kids.filter((k) => k.enrolled_on && k.enrolled_on >= addDays(today, -60));
  if (!fresh.length) return null;
  const t = getT().club.onboarding;
  const { data: pending } = await db.from("contracts").select("id, player_id").eq("status", "sent").in("player_id", fresh.map((k) => k.id));
  const rows = fresh.map((k) => {
    const contract = (pending ?? []).find((c) => c.player_id === k.id);
    const visaOk = !!k.medical_visa_expires_on && k.medical_visa_expires_on >= today;
    return { k, contract, visaOk, visaSent: visaPending.has(k.id), sizeOk: !!k.kit_size };
  }).filter((r) => r.contract || !r.visaOk || !r.sizeOk);
  if (!rows.length) return null;
  return (
    <Card className="border-brand/40">
      <CardHeader title={t.title} description={t.description} />
      <CardBody className="space-y-4">
        {rows.map(({ k, contract, visaOk, visaSent, sizeOk }) => (
          <section key={k.id}>
            {rows.length > 1 ? <h3 className="mb-1 text-base">{k.full_name}</h3> : null}
            <ol className="divide-y divide-line">
              <Item done>{t.account}</Item>
              <Item done={!contract}>
                {contract ? <Link href={`/contracte/${contract.id}`} className="font-semibold underline underline-offset-4">{t.contract}</Link> : t.contractDone}
              </Item>
              <Item done={visaOk}>
                {visaOk ? t.visaDone : visaSent ? t.visaSent : <a href={`#copil-${k.id}`} className="font-semibold underline underline-offset-4">{t.visa}</a>}
              </Item>
              <Item done={sizeOk}>
                <span className="mb-1 block">{sizeOk ? t.sizeDone(k.kit_size!) : t.size}</span>
                {!sizeOk ? <KitSizeSelect playerId={k.id} value={k.kit_size} /> : null}
              </Item>
            </ol>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

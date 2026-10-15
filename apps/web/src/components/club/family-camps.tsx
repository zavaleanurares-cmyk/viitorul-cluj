import Link from "next/link";
import { ChevronRight, Tent } from "lucide-react";
import { formatDate, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Pe „Azi": taberele deschise la care familia nu și-a înscris încă copilul (doar dacă există). */
export async function FamilyCampsCard({ db, today }: { db: Db; today: string }) {
  const t = getT().club.camps;
  const [{ data: camps }, { data: regs }] = await Promise.all([
    db.from("camps").select("id, title, starts_on, ends_on, deadline").eq("status", "open").gte("starts_on", today).order("starts_on").limit(5),
    db.from("camp_registrations").select("camp_id").neq("status", "cancelled"),
  ]);
  const done = new Set((regs ?? []).map((r) => r.camp_id));
  const open = (camps ?? []).filter((c) => !done.has(c.id) && (c.deadline ?? c.starts_on) >= today).slice(0, 2);
  if (!open.length) return null;
  return (
    <Card>
      <CardHeader title={t.family.card} action={<Link href="/tabere" className="font-semibold underline underline-offset-4">{t.family.all}</Link>} />
      <CardBody>
        <ul className="divide-y divide-line">
          {open.map((c) => (
            <li key={c.id}>
              <Link href="/tabere" className="flex min-h-12 items-center gap-3 py-2 hover:bg-canvas">
                <Tent className="size-5 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-sm text-ink-3">{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}{c.deadline ? ` · ${t.deadline(formatDate(c.deadline))}` : ""}</span>
                </span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

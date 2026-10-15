import Link from "next/link";
import { ChevronRight, FileSignature } from "lucide-react";
import { formatDate, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Pe „Azi": documentele care așteaptă semnătura mea (doar dacă există). */
export async function FamilyContractsCard({ db }: { db: Db }) {
  const t = getT().club.contracts;
  const { data } = await db.from("contracts").select("id, title, due_on, players(display_name)").eq("status", "sent").order("sent_at", { ascending: false }).limit(5);
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader title={t.family.card} action={<Link href="/contracte" className="font-semibold underline underline-offset-4">{t.family.all}</Link>} />
      <CardBody>
        <ul className="divide-y divide-line">
          {data.map((c) => (
            <li key={c.id}>
              <Link href={`/contracte/${c.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-canvas">
                <FileSignature className="size-5 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-sm text-ink-3">
                    {(c.players as { display_name: string } | null)?.display_name ?? ""}
                    {c.due_on ? ` · ${t.family.dueBy(formatDate(c.due_on))}` : ""}
                  </span>
                </span>
                <span className="hidden text-sm font-semibold sm:inline">{t.family.open}</span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

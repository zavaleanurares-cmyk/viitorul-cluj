import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleCheck, CircleDashed } from "lucide-react";
import { formatDateTime } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { CancelMessageButton } from "@/components/club/cancel-message";
import { getT } from "@/messages";

export const metadata = { title: "Mesaj" };

export default async function MessageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("clubMessages");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: m } = await db.from("messages").select("id, title, body, status, scheduled_at, sent_at, recipient_count").eq("id", id).maybeSingle();
  if (!m) notFound();
  const t = getT().club.messages;
  const { data: rec } = await db.from("message_recipients").select("user_id, name, reason, read_at").eq("message_id", id).limit(3000);
  const rows = (rec ?? []).map((r) => ({ ...r, name: r.name ?? "—" }))
    .sort((a, b) => Number(!!a.read_at) - Number(!!b.read_at) || a.name.localeCompare(b.name, "ro"));
  const read = rows.filter((r) => r.read_at).length;
  const tz = ctx.settings.timezone;
  return (
    <>
      <PageHeader back={<Link href="/club/mesaje" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>}
        title={m.title} description={`${t.status[m.status as "sent"]} · ${m.status === "scheduled" ? t.scheduledFor(formatDateTime(m.scheduled_at, tz)) : formatDateTime(m.sent_at ?? m.scheduled_at, tz)}`}
        action={m.status === "scheduled" ? <CancelMessageButton id={m.id} /> : undefined} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card><CardBody><p className="whitespace-pre-line">{m.body}</p></CardBody></Card>
        {m.status === "sent" ? (
          <Card>
            <CardHeader title={t.detailRecipients} description={t.readStats(read, rows.length)} />
            <CardBody>
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.user_id} className="flex items-center gap-3 py-2">
                    {r.read_at ? <CircleCheck className="size-5 shrink-0 text-st-green" aria-label={t.read} /> : <CircleDashed className="size-5 shrink-0 text-ink-3" aria-label={t.unread} />}
                    <span className="min-w-0"><span className="block font-semibold">{r.name}</span><span className="block text-sm text-ink-3">{r.reason}</span></span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}

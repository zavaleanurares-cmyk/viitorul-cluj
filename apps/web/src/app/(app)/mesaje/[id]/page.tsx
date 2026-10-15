import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDateTime } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";

export const metadata = { title: "Mesaj" };

/** Citirea unui mesaj (o marchează citită pentru statisticile clubului). */
export default async function ReadMessage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: m } = await db.from("messages").select("id, title, body, sent_at, author_id").eq("id", id).eq("status", "sent").maybeSingle();
  if (!m) notFound();
  await db.rpc("mark_message_read", { p_id: id });
  const t = getT().club.messages;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={<Link href="/mesaje" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.inbox}</Link>}
        title={m.title} description={formatDateTime(m.sent_at ?? "", ctx.settings.timezone)} />
      <Card><CardBody><p className="whitespace-pre-line text-lg leading-relaxed">{m.body}</p></CardBody></Card>
    </div>
  );
}

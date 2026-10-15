import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDate, type SiteBlock } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { BlocksView } from "@/components/site/blocks";
import { getT } from "@/messages";

export const metadata = { title: "Noutăți" };

export default async function FamilyPost({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await db.from("site_posts").select("id, title, blocks, cover_path, published_at, status, to_app").eq("id", id).maybeSingle();
  if (!p || p.status !== "published" || !p.to_app) notFound();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.userId).eq("dedupe_key", `news:${id}`).is("read_at", null);
  const t = getT().club.website.family;
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link href="/noutati" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>
      <p className="text-ink-3">{formatDate(p.published_at!.slice(0, 10))}</p>
      <h1 className="text-3xl md:text-4xl">{p.title}</h1>
      {p.cover_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/site/${p.cover_path}`} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
      ) : null}
      <BlocksView blocks={(p.blocks ?? []) as SiteBlock[]} mediaBase="/api/files/site" />
    </article>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { SiteBlock } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { PostComposer } from "@/components/club/post-composer";
import { getT } from "@/messages";

export const metadata = { title: "Știre" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("manageWebsite");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await db.from("site_posts").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const t = getT().club.website;
  return (
    <>
      <PageHeader back={<Link href="/club/site" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.tabs.news}</Link>}
        title={t.news.editTitle} description={p.status === "published" && p.to_site ? <a className="underline underline-offset-4" href={`/c/${ctx.club.slug}/stiri/${p.slug}`} target="_blank" rel="noreferrer">/c/{ctx.club.slug}/stiri/{p.slug}</a> : undefined} />
      <PostComposer clubId={ctx.club.id} status={p.status as "draft" | "published"} groups={ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }))}
        initial={{ id: p.id, title: p.title, excerpt: p.excerpt ?? "", blocks: (p.blocks ?? []) as SiteBlock[], coverPath: p.cover_path, toSite: p.to_site, toApp: p.to_app, groupIds: p.app_group_ids ?? [] }} />
    </>
  );
}

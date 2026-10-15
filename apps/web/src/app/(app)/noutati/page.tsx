import { Newspaper } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { FamilyClubTabs } from "@/components/club/family-tabs";
import { PostCard } from "@/components/site/post-card";
import { getT } from "@/messages";

export const metadata = { title: "Noutăți" };

/** Știrile publicate în aplicație pentru familia mea (RLS: echipele copiilor). */
export default async function FamilyNews() {
  const { db, ctx } = await requireSession();
  const t = getT().club.website.family;
  const { data } = await db.from("site_posts").select("id, title, slug, excerpt, cover_path, published_at").eq("status", "published").eq("to_app", true).order("published_at", { ascending: false }).limit(60);
  return (
    <div className="mx-auto max-w-3xl">
      {ctx.role === "guardian" || ctx.role === "player" ? <FamilyClubTabs current="messages" /> : null}
      <PageHeader title={t.title} />
      {!data?.length ? <EmptyState icon={<Newspaper className="size-8" aria-hidden />} title={t.empty} /> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((p) => <li key={p.id}><PostCard post={{ ...p, published_at: p.published_at! }} href={`/noutati/${p.id}`} media="/api/files/site" /></li>)}
        </ul>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { createAnonDb } from "@club/db";
import { formatDate } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export const metadata = { title: "Protecția datelor" };

export default async function PublicPolicy({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const { data } = await createAnonDb().rpc("public_policy", { p_slug: club.slug });
  const p = ((data ?? []) as Array<{ version: number; body: string; published_at: string }>)[0];
  if (!p) notFound();
  const t = getT();
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl md:text-4xl">{t.site.privacy}</h1>
      <p className="text-sm text-ink-3">{t.club.website.public.policyVersion(p.version, formatDate(p.published_at.slice(0, 10)))}</p>
      <div className="whitespace-pre-line text-lg leading-relaxed">{p.body}</div>
    </article>
  );
}

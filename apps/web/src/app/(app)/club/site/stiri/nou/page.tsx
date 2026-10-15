import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { PostComposer } from "@/components/club/post-composer";
import { getT } from "@/messages";

export const metadata = { title: "Știre nouă" };

export default async function NewPostPage() {
  const { ctx } = await requireCapability("manageWebsite");
  const t = getT().club.website;
  return (
    <>
      <PageHeader back={<Link href="/club/site" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.tabs.news}</Link>} title={t.news.newTitle} />
      <PostComposer clubId={ctx.club.id} status={null} groups={ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }))} />
    </>
  );
}

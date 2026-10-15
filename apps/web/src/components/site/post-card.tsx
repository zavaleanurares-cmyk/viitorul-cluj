import Link from "next/link";
import { Newspaper } from "lucide-react";
import { formatDate } from "@club/shared";

export type PostSummary = { id: string; title: string; slug: string; excerpt: string | null; cover_path: string | null; published_at: string };

export function PostCard({ post, href, media, big }: { post: PostSummary; href: string; media: string; big?: boolean }) {
  return (
    <Link href={href} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface hover:border-line-strong shadow-[var(--shadow-card)]">
      {post.cover_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${media}/${post.cover_path}`} alt="" loading="lazy" className={big ? "aspect-[16/9] w-full object-cover" : "aspect-[16/10] w-full object-cover"} />
      ) : <span className="flex aspect-[16/10] items-center justify-center bg-sunken"><Newspaper className="size-10 text-ink-3" aria-hidden /></span>}
      <span className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-sm text-ink-3">{formatDate(post.published_at.slice(0, 10))}</span>
        <span className={big ? "text-2xl font-bold group-hover:underline" : "text-lg font-bold group-hover:underline"}>{post.title}</span>
        {post.excerpt ? <span className="line-clamp-3 text-ink-2">{post.excerpt}</span> : null}
      </span>
    </Link>
  );
}

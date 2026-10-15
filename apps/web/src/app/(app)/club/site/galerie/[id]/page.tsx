import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { AlbumActions, PhotoGrid, PhotoUploader } from "@/components/club/gallery-admin";
import { getT } from "@/messages";

export const metadata = { title: "Album" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("manageWebsite");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().club.website;
  const { data: a } = await db.from("site_albums").select("id, title, taken_on, status").eq("id", id).maybeSingle();
  if (!a) notFound();
  const [{ data: photos }, { data: state }, { data: players }] = await Promise.all([
    db.from("site_photos").select("id, path, caption, player_ids").eq("album_id", id).order("sort").order("created_at"),
    db.rpc("photo_consent_state", { p_album: id }),
    db.from("players").select("id, full_name, group_id, photo_consent").eq("is_active", true).is("anonymized_at", null).order("full_name"),
  ]);
  const st = new Map(((state ?? []) as Array<{ photo_id: string; is_public: boolean; missing: string[]; reviewed: boolean }>).map((s) => [s.photo_id, s]));
  const list = (photos ?? []).map((p) => ({ ...p, isPublic: st.get(p.id)?.is_public ?? false, missing: st.get(p.id)?.missing ?? [], reviewed: st.get(p.id)?.reviewed ?? false }));
  const pub = list.filter((p) => p.isPublic).length;
  return (
    <div className="space-y-4">
      <PageHeader back={<Link href="/club/site/galerie" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.tabs.gallery}</Link>}
        title={a.title}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={a.status === "published" ? "green" : "gray"}>{a.status === "published" ? t.news.published : t.news.draft}</Badge>{a.taken_on ? formatDate(a.taken_on) : null} · {t.gallery.publicN(pub, list.length)}</span>}
        action={<AlbumActions id={a.id} title={a.title} takenOn={a.taken_on} published={a.status === "published"} />} />
      <PhotoUploader clubId={ctx.club.id} albumId={a.id} />
      <PhotoGrid albumId={a.id} photos={list} published={a.status === "published"}
        players={(players ?? []).map((p) => ({ id: p.id, name: p.full_name, team: ctx.groups.find((g) => g.id === p.group_id)?.name ?? "", consent: p.photo_consent }))} />
    </div>
  );
}

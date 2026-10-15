"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, ImagePlus, Plus, Tag, Trash2, Upload } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { addPhoto, deleteAlbum, deletePhoto, saveAlbum, updatePhoto } from "@/app/(app)/club/site/actions";

export function NewAlbumButton() {
  const t = useT().club.website.gallery;
  const c = useT().common;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const save = useAction(saveAlbum, { onSuccess: (r) => router.push(`/club/site/galerie/${r.id}`) });
  return (
    <>
      <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.new}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.new}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button><Button disabled={title.trim().length < 2} pending={save.pending} onClick={() => save.run({ title, takenOn: date })}>{c.actions.save}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label={t.albumTitle}><Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={t.takenOn} optional><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <FormError>{save.error}</FormError>
      </Dialog>
    </>
  );
}

export function AlbumActions({ id, title, takenOn, published }: { id: string; title: string; takenOn: string | null; published: boolean }) {
  const t = useT().club.website.gallery;
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const save = useAction(saveAlbum);
  const del = useAction(deleteAlbum, { onSuccess: () => router.push("/club/site/galerie") });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sure ? <Button variant="danger" pending={del.pending} onClick={() => del.run(id)}>{t.deleteAlbum}</Button>
        : <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setSure(true)}>{t.deleteAlbum}</Button>}
      <Button variant={published ? "secondary" : "primary"} pending={save.pending} onClick={() => save.run({ id, title, takenOn: takenOn ?? "", status: published ? "draft" : "published" })}>
        {published ? t.unpublish : t.publish}
      </Button>
    </div>
  );
}

export function PhotoUploader({ clubId, albumId }: { clubId: string; albumId: string }) {
  const t = useT().club.website.gallery;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (files: File[]) => {
    setErr(null); setBusy({ done: 0, total: files.length });
    for (const [i, f] of files.entries()) {
      const ext = (f.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
      const path = `${clubId}/foto/${crypto.randomUUID()}.${ext}`;
      const up = await uploadFile("site", path, f);
      if (!up.ok) { setErr(up.error); continue; }
      const r = await addPhoto({ albumId, path });
      if (!r.ok) setErr(r.error);
      setBusy({ done: i + 1, total: files.length });
    }
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="space-y-1">
      <Button icon={<Upload className="size-5" aria-hidden />} pending={!!busy} onClick={() => input.current?.click()}>
        {busy ? `${busy.done} / ${busy.total}` : t.upload}
      </Button>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
        onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) void run(fs); }} />
      <p className="text-sm text-ink-3">{t.uploadHint}</p>
      <FormError>{err}</FormError>
    </div>
  );
}

type Photo = { id: string; path: string; caption: string | null; player_ids: string[]; isPublic: boolean; missing: string[]; reviewed: boolean };

export function PhotoGrid({ albumId, photos, players, published }: { albumId: string; photos: Photo[]; players: Array<{ id: string; name: string; team: string; consent: boolean }>; published: boolean }) {
  const t = useT().club.website.gallery;
  const [edit, setEdit] = useState<Photo | null>(null);
  if (!photos.length) return <p className="flex items-center gap-2 text-ink-3"><ImagePlus className="size-5" aria-hidden />{t.uploadHint}</p>;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface">
            <button type="button" onClick={() => setEdit(p)} className="block w-full text-left" aria-label={t.tag}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/site/${p.path}`} alt={p.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="block space-y-1 p-2 text-sm">
                <span className={cn("flex items-center gap-1 font-semibold", p.isPublic ? "text-st-green" : "text-ink-2")}>
                  {p.isPublic ? <><Check className="size-4" aria-hidden />{t.publicOk}</> : <><EyeOff className="size-4" aria-hidden />{!p.reviewed ? t.unreviewed : p.missing.length ? t.hidden(p.missing.join(", ")) : !published ? t.hiddenDraft : ""}</>}
                </span>
                <span className="flex items-center gap-1 text-ink-3"><Tag className="size-4" aria-hidden />{p.player_ids.length ? players.filter((x) => p.player_ids.includes(x.id)).map((x) => x.name).join(", ") : t.noTags}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {edit ? <PhotoDialog key={edit.id} albumId={albumId} photo={edit} players={players} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function PhotoDialog({ albumId, photo, players, onClose }: { albumId: string; photo: Photo; players: Array<{ id: string; name: string; team: string; consent: boolean }>; onClose: () => void }) {
  const t = useT().club.website.gallery;
  const c = useT().common;
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [tags, setTags] = useState<string[]>(photo.player_ids);
  const [q, setQ] = useState("");
  const save = useAction(updatePhoto, { onSuccess: onClose });
  const del = useAction(deletePhoto, { onSuccess: onClose });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const found = q.trim() ? players.filter((p) => !tags.includes(p.id) && norm(p.name).includes(norm(q.trim()))).slice(0, 8) : [];
  return (
    <Dialog open onClose={onClose} title={t.tag} wide
      footer={<>
        <IconButton label={t.deletePhoto} onClick={() => del.run({ id: photo.id, albumId })}><Trash2 className="size-5" aria-hidden /></IconButton>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose}>{c.actions.cancel}</Button>
        <Button pending={save.pending} onClick={() => save.run({ id: photo.id, albumId, caption, playerIds: tags })}>{c.actions.save}</Button>
      </>}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/files/site/${photo.path}`} alt="" className="w-full rounded-[var(--radius-control)] object-contain" />
        <div className="space-y-3">
          <p className="text-sm text-ink-2">{t.tagHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((id) => {
              const p = players.find((x) => x.id === id);
              return (
                <button key={id} type="button" onClick={() => setTags(tags.filter((x) => x !== id))}
                  className={cn("inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold", p?.consent ? "bg-st-green/15 text-ink" : "bg-st-yellow/25 text-ink")}>
                  {p?.name ?? "?"} {!p?.consent ? <EyeOff className="size-4" aria-label="fără acord" /> : null}<span aria-hidden>×</span>
                </button>
              );
            })}
          </div>
          <Field label={t.tagSearch}><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          {found.length ? (
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {found.map((p) => (
                <li key={p.id}><button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-canvas" onClick={() => { setTags([...tags, p.id]); setQ(""); }}>
                  <span><span className="font-semibold">{p.name}</span> <span className="text-sm text-ink-3">{p.team}</span></span>
                  {!p.consent ? <EyeOff className="size-4 text-ink-3" aria-label="fără acord" /> : null}
                </button></li>
              ))}
            </ul>
          ) : null}
          <Field label={t.caption} optional><Input value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} /></Field>
          <p className="text-sm text-ink-3">{t.consentNote}</p>
          <FormError>{save.error ?? del.error}</FormError>
        </div>
      </div>
    </Dialog>
  );
}

"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Heading2, ImagePlus, List, Pilcrow, Quote, Save, Send, Trash2, Undo2, X } from "lucide-react";
import type { SiteBlock } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { BlocksView } from "@/components/site/blocks";
import { deletePost, publishPost, savePost } from "@/app/(app)/club/site/actions";

type Draft = { id?: string; title: string; excerpt: string; blocks: SiteBlock[]; coverPath: string | null; toSite: boolean; toApp: boolean; groupIds: string[] };
const MEDIA = "/api/files/site";
const ICONS = { paragraph: Pilcrow, heading: Heading2, image: ImagePlus, quote: Quote, list: List } as const;

/**
 * Editorul de știri: blocuri simple (paragraf, subtitlu, imagine, citat, listă), previzualizare alături,
 * publicare pe site și/sau în aplicație (cu echipele care primesc notificarea).
 */
export function PostComposer({ clubId, initial, status, groups }: { clubId: string; initial?: Draft; status: "draft" | "published" | null; groups: Array<{ id: string; name: string }> }) {
  const t = useT().club.website.news;
  const c = useT().common;
  const [sure, setSure] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial ?? { title: "", excerpt: "", blocks: [{ type: "paragraph", text: "" }], coverPath: null, toSite: true, toApp: false, groupIds: [] });
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const save = useAction(savePost, { successMessage: false });
  const publish = useAction(publishPost, { successMessage: false });
  const remove = useAction(deletePost, { successMessage: false, onSuccess: () => router.push("/club/site") });
  const set = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }));
  const setBlock = (i: number, b: SiteBlock) => set({ blocks: d.blocks.map((x, k) => (k === i ? b : x)) });
  const move = (i: number, dir: -1 | 1) => { const b = [...d.blocks]; [b[i], b[i + dir]] = [b[i + dir], b[i]]; set({ blocks: b }); };

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true); setUpErr(null);
    const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${clubId}/post/${crypto.randomUUID()}.${ext}`;
    const res = await uploadFile("site", path, file);
    setUploading(false);
    if (!res.ok) { setUpErr(res.error || t.uploadFailed); return null; }
    return path;
  };
  const addBlock = async (type: SiteBlock["type"], file?: File) => {
    if (type === "image") {
      if (!file) return;
      const path = await upload(file);
      if (path) set({ blocks: [...d.blocks, { type: "image", path, alt: "", caption: "" }] });
      return;
    }
    const b: SiteBlock = type === "list" ? { type, items: [""] } : type === "quote" ? { type, text: "", by: "" } : { type, text: "" };
    set({ blocks: [...d.blocks, b] });
  };

  const persist = async (): Promise<string | null> => {
    const r = await save.run({ ...d, excerpt: d.excerpt });
    if (!r.ok) return null;
    if (!d.id) { set({ id: r.data.id }); router.replace(`/club/site/stiri/${r.data.id}`); }
    return r.data.id;
  };
  const onSave = async () => { if (await persist()) toast(t.saved); };
  const onPublish = async (on: boolean) => {
    const id = await persist();
    if (!id) return;
    const r = await publish.run({ id, publish: on });
    if (r.ok) toast(on ? t.notified(r.data) : t.unpublish);
  };
  const imgInput = useRef<HTMLInputElement>(null);
  const busy = save.pending || publish.pending || uploading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <Button variant={view === "edit" ? "primary" : "secondary"} size="sm" onClick={() => setView("edit")}>{t.edit}</Button>
        <Button variant={view === "preview" ? "primary" : "secondary"} size="sm" icon={<Eye className="size-4" aria-hidden />} onClick={() => setView("preview")}>{t.preview}</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn("space-y-4", view === "preview" && "hidden lg:block")}>
          <Field label={t.fields.title}><Input value={d.title} maxLength={160} className="text-lg font-semibold" onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label={t.fields.excerpt} hint={t.fields.excerptHint} optional><Textarea rows={2} value={d.excerpt} maxLength={300} onChange={(e) => set({ excerpt: e.target.value })} /></Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-2">{t.fields.cover}</p>
            {d.coverPath ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${MEDIA}/${d.coverPath}`} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
                <Button size="sm" variant="secondary" className="absolute right-2 top-2" icon={<X className="size-4" aria-hidden />} onClick={() => set({ coverPath: null })}>{t.fields.coverRemove}</Button>
              </div>
            ) : (
              <Button variant="secondary" pending={uploading} icon={<ImagePlus className="size-5" aria-hidden />} onClick={() => coverInput.current?.click()}>{t.fields.coverPick}</Button>
            )}
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const p = await upload(f); if (p) set({ coverPath: p }); } }} />
          </div>

          <ol className="space-y-3">
            {d.blocks.map((b, i) => {
              const Icon = ICONS[b.type];
              return (
                <li key={i} className="rounded-[var(--radius-control)] border border-line bg-surface p-3">
                  <div className="mb-2 flex items-center gap-1">
                    <Icon className="size-4 text-ink-3" aria-hidden />
                    <span className="flex-1 text-sm font-semibold text-ink-3">{t.blocks[b.type]}</span>
                    <IconButton label={t.moveUp} className="size-9" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" aria-hidden /></IconButton>
                    <IconButton label={t.moveDown} className="size-9" disabled={i === d.blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" aria-hidden /></IconButton>
                    <IconButton label={t.remove} className="size-9" onClick={() => set({ blocks: d.blocks.filter((_, k) => k !== i) })}><Trash2 className="size-4" aria-hidden /></IconButton>
                  </div>
                  {b.type === "paragraph" ? <Textarea aria-label={t.blocks.paragraph} rows={4} value={b.text} maxLength={5000} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} /> : null}
                  {b.type === "heading" ? <Input aria-label={t.blocks.heading} value={b.text} maxLength={160} className="font-semibold" onChange={(e) => setBlock(i, { ...b, text: e.target.value })} /> : null}
                  {b.type === "quote" ? (
                    <div className="space-y-2">
                      <Textarea aria-label={t.blocks.quote} rows={2} value={b.text} maxLength={1000} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} />
                      <Input aria-label={t.fields.quoteBy} placeholder={t.fields.quoteBy} value={b.by ?? ""} maxLength={120} onChange={(e) => setBlock(i, { ...b, by: e.target.value })} />
                    </div>
                  ) : null}
                  {b.type === "list" ? (
                    <div className="space-y-1.5">
                      {b.items.map((it, k) => (
                        <div key={k} className="flex gap-1">
                          <Input aria-label={`${t.fields.listItem} ${k + 1}`} value={it} maxLength={300} onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, j) => (j === k ? e.target.value : x)) })} />
                          <IconButton label={t.remove} className="size-12" onClick={() => setBlock(i, { ...b, items: b.items.filter((_, j) => j !== k) })}><X className="size-4" aria-hidden /></IconButton>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => setBlock(i, { ...b, items: [...b.items, ""] })}>{t.addItem}</Button>
                    </div>
                  ) : null}
                  {b.type === "image" ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${MEDIA}/${b.path}`} alt="" className="max-h-56 rounded-[var(--radius-control)] object-cover" />
                      <Input aria-label={t.fields.alt} placeholder={t.fields.alt} value={b.alt ?? ""} maxLength={200} onChange={(e) => setBlock(i, { ...b, alt: e.target.value })} />
                      <Input aria-label={t.fields.caption} placeholder={t.fields.caption} value={b.caption ?? ""} maxLength={300} onChange={(e) => setBlock(i, { ...b, caption: e.target.value })} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm font-semibold text-ink-3">{t.add}:</span>
            {(["paragraph", "heading", "image", "quote", "list"] as const).map((k) => {
              const Icon = ICONS[k];
              return <Button key={k} size="sm" variant="secondary" pending={k === "image" && uploading} icon={<Icon className="size-4" aria-hidden />}
                onClick={() => (k === "image" ? imgInput.current?.click() : addBlock(k))}>{t.blocks[k]}</Button>;
            })}
            <input ref={imgInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addBlock("image", f); }} />
          </div>
          <FormError>{upErr}</FormError>

          <fieldset className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface p-3">
            <legend className="px-1 font-semibold">{t.publishTo}</legend>
            <Checkbox label={t.toSite} checked={d.toSite} onChange={(e) => set({ toSite: e.target.checked })} />
            <Checkbox label={t.toApp} checked={d.toApp} onChange={(e) => set({ toApp: e.target.checked })} />
            {d.toApp ? (
              <div className="pl-8">
                <p className="mb-1 text-sm font-semibold text-ink-2">{t.audience}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip on={!d.groupIds.length} onClick={() => set({ groupIds: [] })}>{t.allTeams}</Chip>
                  {groups.map((g) => <Chip key={g.id} on={d.groupIds.includes(g.id)} onClick={() => set({ groupIds: d.groupIds.includes(g.id) ? d.groupIds.filter((x) => x !== g.id) : [...d.groupIds, g.id] })}>{g.name}</Chip>)}
                </div>
                <p className="mt-1 text-sm text-ink-3">{t.appHint}</p>
              </div>
            ) : null}
          </fieldset>
        </div>

        <article className={cn("space-y-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto shadow-[var(--shadow-card)]", view === "edit" && "hidden lg:block")} aria-label={t.preview}>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">{t.preview}</p>
          {d.coverPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${MEDIA}/${d.coverPath}`} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
          ) : null}
          <h1 className="text-3xl">{d.title || t.fields.title}</h1>
          {d.excerpt.trim() ? <p className="text-lg font-semibold text-ink-2">{d.excerpt}</p> : null}
          <BlocksView blocks={d.blocks} mediaBase={MEDIA} />
        </article>
      </div>

      <FormError>{save.error ?? publish.error}</FormError>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        {d.id ? (sure
          ? <><span className="text-sm text-ink-2">{t.deleteConfirm}</span><Button variant="danger" pending={remove.pending} onClick={() => remove.run(d.id!)}>{t.delete}</Button><Button variant="ghost" onClick={() => setSure(false)}>{c.actions.cancel}</Button></>
          : <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setSure(true)}>{t.delete}</Button>) : null}
        <span className="flex-1" />
        {status === "published" ? (
          <>
            <Button variant="secondary" disabled={busy} icon={<Undo2 className="size-5" aria-hidden />} onClick={() => onPublish(false)}>{t.unpublish}</Button>
            <Button disabled={busy || d.title.trim().length < 3} pending={save.pending} icon={<Save className="size-5" aria-hidden />} onClick={() => onPublish(true)}>{t.update}</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={busy || d.title.trim().length < 3} pending={save.pending && !publish.pending} icon={<Save className="size-5" aria-hidden />} onClick={onSave}>{t.save}</Button>
            <Button disabled={busy || d.title.trim().length < 3 || (!d.toSite && !d.toApp)} pending={publish.pending} icon={<Send className="size-5" aria-hidden />} onClick={() => onPublish(true)}>{t.publish}</Button>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={on ? "inline-flex h-10 items-center rounded-full bg-ink px-3 text-sm font-semibold text-surface" : "inline-flex h-10 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>
      {children}
    </button>
  );
}

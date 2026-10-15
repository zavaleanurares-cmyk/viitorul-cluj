"use client";
import { useRef, useState } from "react";
import { ImagePlus, Package, PackageCheck, Pencil, Plus, Undo2, X } from "lucide-react";
import { KIT_SIZES, SHOE_SIZES, kitSizeLabel } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { cancelOrder, saveProduct, setOrderStatus, type ProductInput } from "@/app/(app)/club/magazin/actions";

type Kind = "item" | "bundle";
const sizesFor = (k: ProductInput["sizeKind"]) => (k === "apparel" ? [...KIT_SIZES] : k === "shoes" ? [...SHOE_SIZES] : []);

export function ProductButton({ clubId, product, kind = "item", items }: {
  clubId: string; product?: ProductInput & { id: string }; kind?: Kind; items: Array<{ id: string; name: string }>;
}) {
  const t = useT().club.shop;
  const c = useT().common;
  const blank: ProductInput = { name: "", description: "", category: "kit", price: "", photoPaths: [], kind, sizeKind: kind === "bundle" ? "none" : "apparel", active: true, variants: [], bundleItems: [] };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ProductInput>(product ?? blank);
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const save = useAction(saveProduct, { onSuccess: () => setOpen(false) });
  const set = (p: Partial<ProductInput>) => setV({ ...v, ...p });
  const stockOf = (size: string | null) => v.variants.find((x) => x.size === size);
  const toggleSize = (size: string, on: boolean) => set({ variants: on ? [...v.variants, { size, stock: 0 }] : v.variants.filter((x) => x.size !== size) });
  const setStock = (size: string | null, stock: number) => set({ variants: stockOf(size) ? v.variants.map((x) => (x.size === size ? { ...x, stock } : x)) : [...v.variants, { size, stock }] });
  const upload = async (f: File) => {
    setBusy(true); setUpErr(null);
    const path = `${clubId}/${crypto.randomUUID()}.${(f.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg")}`;
    const r = await uploadFile("shop", path, f);
    setBusy(false);
    if (r.ok) set({ photoPaths: [...v.photoPaths, path] }); else setUpErr(r.error);
  };
  const isBundle = v.kind === "bundle";
  return (
    <>
      {product ? <IconButton label={t.products.edit} onClick={() => { setV(product); setOpen(true); }}><Pencil className="size-5" aria-hidden /></IconButton>
        : <Button variant={kind === "bundle" ? "secondary" : "primary"} icon={kind === "bundle" ? <Package className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>
          {kind === "bundle" ? t.products.newBundle : t.products.new}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={product ? t.products.edit : isBundle ? t.products.newBundle : t.products.new} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={busy || v.name.trim().length < 2 || !v.price} onClick={() => save.run(v)}>{c.actions.save}</Button>
        </>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label={t.products.fields.name}><Input value={v.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t.products.fields.category}>
              <Select value={v.category} onChange={(e) => set({ category: e.target.value as ProductInput["category"] })}>
                {(Object.keys(t.categories) as Array<keyof typeof t.categories>).map((k) => <option key={k} value={k}>{t.categories[k]}</option>)}
              </Select>
            </Field>
            <Field label={t.products.fields.price}><Input inputMode="decimal" value={v.price} maxLength={12} onChange={(e) => set({ price: e.target.value })} /></Field>
          </div>
          <Field label={t.products.fields.description} optional><Textarea rows={2} value={v.description ?? ""} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.products.fields.photos}</p>
            <div className="flex flex-wrap gap-2">
              {v.photoPaths.map((p) => (
                <div key={p} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/shop/${p}`} alt="" className="size-24 rounded-[var(--radius-control)] object-cover" />
                  <button type="button" aria-label={c.actions.delete} className="absolute right-1 top-1 rounded-full bg-surface p-1 shadow" onClick={() => set({ photoPaths: v.photoPaths.filter((x) => x !== p) })}><X className="size-4" aria-hidden /></button>
                </div>
              ))}
              {v.photoPaths.length < 6 ? (
                <button type="button" onClick={() => input.current?.click()} disabled={busy}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border-2 border-dashed border-line-strong text-sm text-ink-3 hover:bg-canvas">
                  <ImagePlus className="size-6" aria-hidden />{busy ? "…" : t.products.fields.addPhoto}
                </button>
              ) : null}
            </div>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            <FormError>{upErr}</FormError>
          </div>
          {isBundle ? (
            <fieldset>
              <legend className="mb-1 font-semibold">{t.products.fields.bundleItems}</legend>
              <p className="mb-2 text-sm text-ink-3">{t.products.fields.bundleHint}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.filter((x) => x.id !== product?.id).map((x) => (
                  <Checkbox key={x.id} label={x.name} checked={v.bundleItems.includes(x.id)}
                    onChange={(e) => set({ bundleItems: e.target.checked ? [...v.bundleItems, x.id] : v.bundleItems.filter((y) => y !== x.id) })} />
                ))}
              </div>
            </fieldset>
          ) : (
            <>
              <Field label={t.products.fields.sizeKind}>
                <Select value={v.sizeKind} onChange={(e) => set({ sizeKind: e.target.value as ProductInput["sizeKind"], variants: [] })}>
                  {(Object.keys(t.sizeKinds) as Array<keyof typeof t.sizeKinds>).map((k) => <option key={k} value={k}>{t.sizeKinds[k]}</option>)}
                </Select>
              </Field>
              {v.sizeKind === "none" ? (
                <Field label={t.products.fields.stock}><Input type="number" min={0} className="max-w-32" value={String(stockOf(null)?.stock ?? 0)} onChange={(e) => setStock(null, Math.max(0, Number(e.target.value) || 0))} /></Field>
              ) : (
                <fieldset>
                  <legend className="mb-1 font-semibold">{t.products.fields.sizes}</legend>
                  <p className="mb-2 text-sm text-ink-3">{t.products.fields.sizesHint}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {sizesFor(v.sizeKind).map((s) => {
                      const row = stockOf(s);
                      return (
                        <div key={s} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-2 py-1.5">
                          <input type="checkbox" className="size-5 accent-[var(--color-brand)]" aria-label={s} checked={!!row} onChange={(e) => toggleSize(s, e.target.checked)} />
                          <span className="flex-1 text-sm font-semibold">{v.sizeKind === "apparel" ? kitSizeLabel(s) : s}</span>
                          {row ? <Input type="number" min={0} aria-label={`${t.products.fields.stock} ${s}`} className="h-10 w-20" value={String(row.stock)} onChange={(e) => setStock(s, Math.max(0, Number(e.target.value) || 0))} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </>
          )}
          <Checkbox label={t.products.fields.active} checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function OrderActions({ id, status }: { id: string; status: string }) {
  const t = useT().club.shop.orders;
  const c = useT().common;
  const go = useAction(setOrderStatus);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useAction(cancelOrder, { onSuccess: () => setOpen(false) });
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "placed" ? <Button size="sm" pending={go.pending} icon={<PackageCheck className="size-4" aria-hidden />} onClick={() => go.run({ id, status: "ready" })}>{t.markReady}</Button> : null}
      {status === "ready" ? <>
        <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => go.run({ id, status: "placed" })}>{t.undoReady}</Button>
        <Button size="sm" pending={go.pending} onClick={() => go.run({ id, status: "picked_up" })}>{t.markPicked}</Button>
      </> : null}
      {status === "placed" || status === "ready" ? <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{t.cancel}</Button> : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={t.cancelTitle}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button><Button variant="danger" pending={cancel.pending} onClick={() => cancel.run({ id, reason })}>{t.cancel}</Button></>}>
        <p className="mb-3 text-sm text-ink-2">{t.cancelHint}</p>
        <Field label={t.cancelReason} optional><Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
        <FormError>{cancel.error}</FormError>
      </Dialog>
    </div>
  );
}
